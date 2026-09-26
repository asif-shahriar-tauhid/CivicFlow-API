import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuditLogQuery } from "./auditLog.validation";

const listAuditLogs = async (query: AuditLogQuery) => {
  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const skip = (page - 1) * limit;
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const conditions: Prisma.AuditLogWhereInput[] = [];

  if (query.actorId) conditions.push({ actorId: query.actorId });
  if (query.action) conditions.push({ action: query.action });
  if (query.entity) conditions.push({ entity: query.entity });
  if (query.entityId) conditions.push({ entityId: query.entityId });
  if (query.from || query.to) {
    const ts: Prisma.DateTimeFilter = {};
    if (query.from) ts.gte = query.from;
    if (query.to) ts.lte = query.to;
    conditions.push({ timestamp: ts });
  }

  const where: Prisma.AuditLogWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: sortOrder },
      select: {
        id: true,
        actorId: true,
        actorEmail: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        ipAddress: true,
        route: true,
        userAgent: true,
        timestamp: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const auditLogQueryService = {
  listAuditLogs,
};
