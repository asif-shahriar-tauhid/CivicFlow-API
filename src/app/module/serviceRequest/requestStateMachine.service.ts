import httpStatus from "http-status";
import { RequestStatus, Role } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "./serviceRequest.interface";
import { applyStatusChange } from "../sla/sla.service";
import { NotificationEvent } from "../notification/notification.interface";
import { publishNotification } from "../notification/notification.events";

const transitions: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED: [RequestStatus.TRIAGED, RequestStatus.REJECTED],
  TRIAGED: [
    RequestStatus.ASSIGNED,
    RequestStatus.REJECTED,
    RequestStatus.ON_HOLD,
  ],
  ASSIGNED: [RequestStatus.IN_PROGRESS, RequestStatus.ON_HOLD],
  IN_PROGRESS: [
    RequestStatus.AWAITING_CITIZEN,
    RequestStatus.RESOLVED,
    RequestStatus.ON_HOLD,
  ],
  AWAITING_CITIZEN: [RequestStatus.IN_PROGRESS, RequestStatus.ON_HOLD],
  RESOLVED: [RequestStatus.CLOSED, RequestStatus.REOPENED],
  CLOSED: [RequestStatus.REOPENED],
  REJECTED: [],
  ON_HOLD: [RequestStatus.TRIAGED, RequestStatus.IN_PROGRESS],
  REOPENED: [RequestStatus.IN_PROGRESS, RequestStatus.ON_HOLD],
};

export const isValidTransition = (from: RequestStatus, to: RequestStatus) =>
  transitions[from].includes(to);

export const canTransition = (
  request: {
    status: RequestStatus;
    assignedToId: string | null;
    departmentId: string | null;
    citizenUserId: string;
  },
  to: RequestStatus,
  user: IRequestUser,
) => {
  if (!isValidTransition(request.status, to)) return false;
  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.CITIZEN) {
    return (
      request.citizenUserId === user.userId &&
      (to === RequestStatus.CLOSED || to === RequestStatus.REOPENED)
    );
  }
  return user.role === Role.STAFF && request.departmentId === user.departmentId;
};

const canManageRequest = (
  request: { departmentId: string | null },
  user: IRequestUser,
) =>
  user.role === Role.ADMIN ||
  (user.role === Role.STAFF && request.departmentId === user.departmentId);

const assertTransition = (
  request: Parameters<typeof canTransition>[0],
  to: RequestStatus,
  user: IRequestUser,
  reason?: string,
) => {
  if (!isValidTransition(request.status, to)) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot transition a ${request.status} request to ${to}.`,
    );
  }
  if (!canTransition(request, to, user)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to perform this request transition.",
    );
  }
  if (
    (to === RequestStatus.ASSIGNED ||
      to === RequestStatus.IN_PROGRESS ||
      to === RequestStatus.AWAITING_CITIZEN ||
      to === RequestStatus.RESOLVED) &&
    !request.assignedToId
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A request must have an assignee before work begins.",
    );
  }
  if (!reason && to === RequestStatus.REJECTED) {
    throw new AppError(httpStatus.BAD_REQUEST, "A reason is required.");
  }
};

type TransitionOptions = { reason?: string; focusedLifecycle?: boolean };

const loadRequest = async (
  client: Prisma.TransactionClient,
  requestId: string,
) => {
  const request = await client.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      departmentId: true,
      isDeleted: true,
      resolvedAt: true,
      citizen: { select: { userId: true } },
      statusHistory: {
        where: { to: RequestStatus.REOPENED },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!request || request.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  }
  return {
    ...request,
    citizenUserId: request.citizen.userId,
  };
};

const transition = async (
  requestId: string,
  to: RequestStatus,
  user: IRequestUser,
  options: TransitionOptions = {},
) => {
  const result = await prisma.$transaction(async (tx) => {
    if (
      !options.focusedLifecycle &&
      (to === RequestStatus.RESOLVED ||
        to === RequestStatus.CLOSED ||
        to === RequestStatus.REOPENED)
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Use the focused endpoint for this lifecycle action.",
      );
    }
    const request = await loadRequest(tx, requestId);
    assertTransition(request, to, user, options.reason);
    if (to === RequestStatus.REOPENED) {
      if (user.role !== Role.CITIZEN || request.citizenUserId !== user.userId) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "Only the owning citizen can reopen this request.",
        );
      }
      if (!request.resolvedAt) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This request does not have a resolution date.",
        );
      }
      if (request.statusHistory.length > 0) {
        throw new AppError(
          httpStatus.CONFLICT,
          "This request can only be reopened once.",
        );
      }
      const reopenDeadline =
        request.resolvedAt.getTime() +
        config.request_reopen_window_days * 24 * 60 * 60 * 1000;
      if (Date.now() >= reopenDeadline) {
        throw new AppError(
          httpStatus.CONFLICT,
          "The request reopen window has expired.",
        );
      }
      if (!options.reason?.trim()) {
        throw new AppError(httpStatus.BAD_REQUEST, "A reason is required.");
      }
    }
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: { status: to },
    });
    await applyStatusChange(tx, requestId, request.status, to, user.userId);
    await tx.requestStatusHistory.create({
      data: {
        requestId,
        from: request.status,
        to,
        reason: options.reason?.trim() || null,
        actorId: user.userId,
      },
    });
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        citizen: { select: { userId: true } },
        department: {
          select: {
            users: {
              where: {
                role: Role.STAFF,
                status: "ACTIVE",
                isDeleted: false,
              },
              select: { id: true },
            },
          },
        },
      },
    });
  });
  const eventKey =
    to === RequestStatus.AWAITING_CITIZEN
      ? NotificationEvent.REQUEST_ACTION_REQUIRED
      : to === RequestStatus.REOPENED
        ? NotificationEvent.REQUEST_REOPENED
        : NotificationEvent.REQUEST_STATUS_CHANGED;
  publishNotification({
    recipientId: result.citizen.userId,
    eventKey,
    eventId: `${requestId}:${to}`,
    title:
      to === RequestStatus.AWAITING_CITIZEN
        ? "Action needed on your request"
        : to === RequestStatus.REOPENED
          ? "Service request reopened"
          : "Service request updated",
    message:
      to === RequestStatus.REOPENED
        ? `Service request ${result.requestNumber} was reopened.`
        : `Service request status changed to ${to}.`,
    metadata: { requestId, status: to },
    sendEmail: to === RequestStatus.AWAITING_CITIZEN,
  });
  if (to === RequestStatus.REOPENED) {
    const recipients = new Set(
      result.department?.users.map((staff) => staff.id),
    );
    for (const recipientId of recipients) {
      publishNotification({
        recipientId,
        eventKey: NotificationEvent.REQUEST_REOPENED,
        eventId: requestId,
        title: "Service request reopened",
        message: `Service request ${result.requestNumber} was reopened and needs attention.`,
        metadata: { requestId, status: to },
      });
    }
  }
  return result;
};

const addInvestigationNote = async (
  requestId: string,
  note: string,
  user: IRequestUser,
) =>
  prisma.$transaction(async (tx) => {
    const request = await loadRequest(tx, requestId);
    if (!canManageRequest(request, user)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to add notes to this request.",
      );
    }
    return tx.requestInvestigationNote.create({
      data: { requestId, note: note.trim(), actorId: user.userId },
    });
  });

const resolve = async (
  requestId: string,
  reason: string,
  user: IRequestUser,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const request = await loadRequest(tx, requestId);
    assertTransition(request, RequestStatus.RESOLVED, user);
    if (!reason.trim()) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "A resolution reason is required.",
      );
    }
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.RESOLVED,
        resolutionSummary: reason.trim(),
        resolvedAt: new Date(),
      },
    });
    await applyStatusChange(
      tx,
      requestId,
      request.status,
      RequestStatus.RESOLVED,
      user.userId,
    );
    await tx.requestResolution.create({
      data: { requestId, reason: reason.trim(), actorId: user.userId },
    });
    await tx.requestStatusHistory.create({
      data: {
        requestId,
        from: request.status,
        to: RequestStatus.RESOLVED,
        reason: reason.trim(),
        actorId: user.userId,
      },
    });
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { citizen: { select: { userId: true } } },
    });
  });
  publishNotification({
    recipientId: result.citizen.userId,
    eventKey: NotificationEvent.REQUEST_RESOLVED,
    eventId: requestId,
    title: "Service request resolved",
    message: `Service request ${result.requestNumber} was resolved.`,
    metadata: { requestId, requestNumber: result.requestNumber },
    sendEmail: true,
  });
  return result;
};

const confirm = (requestId: string, user: IRequestUser) =>
  transition(requestId, RequestStatus.CLOSED, user, {
    reason: "Confirmed by citizen.",
    focusedLifecycle: true,
  });

const reopen = (requestId: string, reason: string, user: IRequestUser) =>
  transition(requestId, RequestStatus.REOPENED, user, {
    reason,
    focusedLifecycle: true,
  });

export const requestStateMachineService = {
  transition,
  addInvestigationNote,
  resolve,
  confirm,
  reopen,
};
