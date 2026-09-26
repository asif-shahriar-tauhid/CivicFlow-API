import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
  RequestStatus,
  Role,
  SlaEscalationState,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../serviceRequest/serviceRequest.interface";
import type { ISlaConfigPayload, ISlaQuery } from "./sla.interface";

const pausedStatuses = new Set<RequestStatus>([
  RequestStatus.ON_HOLD,
  RequestStatus.AWAITING_CITIZEN,
]);
const terminalStatuses = [
  RequestStatus.RESOLVED,
  RequestStatus.CLOSED,
  RequestStatus.REJECTED,
];

type SlaClient = Prisma.TransactionClient;

const getPagination = (query: ISlaQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const getDueAtForCategory = async (
  client: SlaClient,
  categoryId: string | null | undefined,
  startedAt: Date,
) => {
  if (!categoryId) return null;
  const category = await client.requestCategory.findUnique({
    where: { id: categoryId },
    select: { slaMinutes: true },
  });
  return category
    ? new Date(startedAt.getTime() + category.slaMinutes * 60_000)
    : null;
};

export const refreshDueAtForCategory = async (
  client: SlaClient,
  requestId: string,
  categoryId: string | null | undefined,
  actorId: string,
  now = new Date(),
) => {
  const dueAt = await getDueAtForCategory(client, categoryId, now);
  await client.serviceRequest.update({
    where: { id: requestId },
    data: {
      slaDueAt: dueAt,
      slaPausedAt: null,
      slaPausedDurationSeconds: 0,
      slaBreachedAt: null,
      slaEscalationState: SlaEscalationState.NONE,
      slaLastEvaluatedAt: null,
    },
  });
  await client.requestSlaAudit.create({
    data: {
      requestId,
      actorId,
      action: "CATEGORY_CHANGED",
      newValue: { categoryId, dueAt: dueAt?.toISOString() ?? null },
    },
  });
};

export const applyStatusChange = async (
  client: SlaClient,
  requestId: string,
  from: RequestStatus,
  to: RequestStatus,
  actorId?: string,
  now = new Date(),
) => {
  const request = await client.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      slaDueAt: true,
      slaPausedAt: true,
      slaPausedDurationSeconds: true,
    },
  });
  if (!request) return;

  const enteringPause = !pausedStatuses.has(from) && pausedStatuses.has(to);
  const leavingPause = pausedStatuses.has(from) && !pausedStatuses.has(to);

  if (enteringPause && !request.slaPausedAt) {
    await client.serviceRequest.update({
      where: { id: requestId },
      data: { slaPausedAt: now },
    });
    await client.requestSlaAudit.create({
      data: {
        requestId,
        actorId,
        action: "PAUSED",
        previousValue: { status: from },
        newValue: { status: to, pausedAt: now.toISOString() },
      },
    });
  }

  if (leavingPause && request.slaPausedAt) {
    const pausedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - request.slaPausedAt.getTime()) / 1000),
    );
    const dueAt = request.slaDueAt
      ? new Date(request.slaDueAt.getTime() + pausedSeconds * 1000)
      : null;
    await client.serviceRequest.update({
      where: { id: requestId },
      data: {
        slaPausedAt: null,
        slaPausedDurationSeconds: { increment: pausedSeconds },
        slaDueAt: dueAt,
      },
    });
    await client.requestSlaAudit.create({
      data: {
        requestId,
        actorId,
        action: "RESUMED",
        previousValue: { pausedAt: request.slaPausedAt.toISOString() },
        newValue: {
          status: to,
          pausedSeconds,
          dueAt: dueAt?.toISOString() ?? null,
        },
      },
    });
  }
};

const requestSelect = {
  id: true,
  requestNumber: true,
  title: true,
  status: true,
  slaDueAt: true,
  slaPausedAt: true,
  slaPausedDurationSeconds: true,
  slaBreachedAt: true,
  slaEscalationState: true,
  department: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.ServiceRequestSelect;

const scopedDepartment = (
  user: IRequestUser,
  requestedDepartmentId?: string,
) => {
  if (user.role === Role.STAFF) return user.departmentId;
  return requestedDepartmentId;
};

const listOverdueRequests = async (query: ISlaQuery, user: IRequestUser) => {
  const { page, limit, skip } = getPagination(query);
  const departmentId = scopedDepartment(user, query.departmentId);
  if (user.role === Role.STAFF && !departmentId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your staff account is not assigned to a department.",
    );
  }
  const where: Prisma.ServiceRequestWhereInput = {
    isDeleted: false,
    slaDueAt: { lte: new Date() },
    slaPausedAt: null,
    status: { notIn: terminalStatuses },
    ...(departmentId ? { departmentId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { slaDueAt: "asc" },
      select: requestSelect,
    }),
    prisma.serviceRequest.count({ where }),
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const configureCategorySla = async (
  categoryId: string,
  payload: ISlaConfigPayload,
  actorId: string,
) =>
  prisma.$transaction(async (tx) => {
    const category = await tx.requestCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, slaMinutes: true },
    });
    if (!category)
      throw new AppError(httpStatus.NOT_FOUND, "Request category not found.");
    const updated = await tx.requestCategory.update({
      where: { id: categoryId },
      data: { slaMinutes: payload.slaMinutes },
    });
    await tx.requestSlaAudit.create({
      data: {
        categoryId,
        actorId,
        action: "CATEGORY_CONFIGURED",
        previousValue: { slaMinutes: category.slaMinutes },
        newValue: { slaMinutes: updated.slaMinutes },
      },
    });
    return updated;
  });

const escalateRequest = async (requestId: string, user: IRequestUser) => {
  const departmentId = scopedDepartment(user);
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      departmentId: true,
      isDeleted: true,
      slaEscalationState: true,
    },
  });
  if (!request || request.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  if (user.role === Role.STAFF && request.departmentId !== departmentId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You cannot escalate requests outside your department.",
    );
  }
  if (request.slaEscalationState === SlaEscalationState.ESCALATED)
    return request;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.serviceRequest.update({
      where: { id: requestId },
      data: { slaEscalationState: SlaEscalationState.ESCALATED },
    });
    await tx.requestSlaAudit.create({
      data: {
        requestId,
        actorId: user.userId,
        action: "ESCALATED",
        previousValue: { state: request.slaEscalationState },
        newValue: { state: SlaEscalationState.ESCALATED },
      },
    });
    return updated;
  });
};

export const processBreaches = async (limit = 100, now = new Date()) => {
  const candidates = await prisma.serviceRequest.findMany({
    where: {
      isDeleted: false,
      slaDueAt: { lte: now },
      slaPausedAt: null,
      slaBreachedAt: null,
      status: { notIn: terminalStatuses },
    },
    orderBy: { slaDueAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: { id: true, requestNumber: true },
  });
  let processed = 0;
  for (const candidate of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.serviceRequest.updateMany({
        where: {
          id: candidate.id,
          slaBreachedAt: null,
          slaPausedAt: null,
          isDeleted: false,
          status: { notIn: terminalStatuses },
        },
        data: {
          slaBreachedAt: now,
          slaLastEvaluatedAt: now,
          slaEscalationState: SlaEscalationState.BREACHED,
        },
      });
      if (updated.count !== 1) return false;
      await tx.requestSlaAudit.create({
        data: {
          requestId: candidate.id,
          action: "BREACHED",
          newValue: {
            breachedAt: now.toISOString(),
            state: SlaEscalationState.BREACHED,
          },
        },
      });
      return true;
    });
    if (result) processed += 1;
  }
  return { scanned: candidates.length, processed };
};

export const slaServices = {
  getDueAtForCategory,
  refreshDueAtForCategory,
  applyStatusChange,
  listOverdueRequests,
  configureCategorySla,
  escalateRequest,
  processBreaches,
};
