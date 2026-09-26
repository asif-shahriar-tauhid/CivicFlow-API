import httpStatus from "http-status";
import { RequestStatus, Role } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "./serviceRequest.interface";

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

type TransitionOptions = { reason?: string };

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
      citizen: { select: { userId: true } },
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
) =>
  prisma.$transaction(async (tx) => {
    if (
      to === RequestStatus.RESOLVED ||
      to === RequestStatus.CLOSED ||
      to === RequestStatus.REOPENED
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Use the focused endpoint for this lifecycle action.",
      );
    }
    const request = await loadRequest(tx, requestId);
    assertTransition(request, to, user, options.reason);
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: { status: to },
    });
    await tx.requestStatusHistory.create({
      data: {
        requestId,
        from: request.status,
        to,
        reason: options.reason?.trim() || null,
        actorId: user.userId,
      },
    });
    return tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  });

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

const resolve = async (requestId: string, reason: string, user: IRequestUser) =>
  prisma.$transaction(async (tx) => {
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
    return tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  });

const confirm = (requestId: string, user: IRequestUser) =>
  transition(requestId, RequestStatus.CLOSED, user, {
    reason: "Confirmed by citizen.",
  });

const reopen = (requestId: string, reason: string, user: IRequestUser) =>
  transition(requestId, RequestStatus.REOPENED, user, { reason });

export const requestStateMachineService = {
  transition,
  addInvestigationNote,
  resolve,
  confirm,
  reopen,
};
