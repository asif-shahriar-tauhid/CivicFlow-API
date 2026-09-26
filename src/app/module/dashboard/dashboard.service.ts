import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { DashboardQuery } from "./dashboard.validation";

const baseWhere = (
  q: DashboardQuery,
): Prisma.ServiceRequestWhereInput => {
  const where: Prisma.ServiceRequestWhereInput = { isDeleted: false };
  if (q.departmentId) where.departmentId = q.departmentId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = q.from;
    if (q.to) where.createdAt.lte = q.to;
  }
  return where;
};

const requestsByStatus = (q: DashboardQuery) =>
  prisma.serviceRequest.groupBy({
    by: ["status"],
    where: baseWhere(q),
    _count: { id: true },
    orderBy: { status: "asc" },
  });

const requestsByCategory = async (q: DashboardQuery) => {
  const where = baseWhere(q);
  const rows = await prisma.serviceRequest.groupBy({
    by: ["categoryId"],
    where,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const categoryIds = rows
    .map((r) => r.categoryId)
    .filter((id): id is string => id !== null);

  const categories =
    categoryIds.length > 0
      ? await prisma.requestCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryId
      ? categoryMap.get(r.categoryId) ?? "Unknown"
      : "Uncategorised",
    count: r._count.id,
  }));
};


const requestsByDepartment = async (q: DashboardQuery) => {
  const where = baseWhere(q);
  const rows = await prisma.serviceRequest.groupBy({
    by: ["departmentId"],
    where,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const departmentIds = rows
    .map((r) => r.departmentId)
    .filter((id): id is string => id !== null);

  const departments =
    departmentIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
  const departmentMap = new Map(departments.map((d) => [d.id, d.name]));

  return rows.map((r) => ({
    departmentId: r.departmentId,
    departmentName: r.departmentId
      ? departmentMap.get(r.departmentId) ?? "Unknown"
      : "Unassigned",
    count: r._count.id,
  }));
};

const slaBreaches = async (q: DashboardQuery) => {
  const where = baseWhere(q);

  const [totalRequests, breachedRequests] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.count({
      where: { ...where, slaBreachedAt: { not: null } },
    }),
  ]);

  return {
    totalRequests,
    breachedRequests,
    complianceRate:
      totalRequests > 0
        ? Math.round(
            ((totalRequests - breachedRequests) / totalRequests) * 10000,
          ) / 100
        : 100,
  };
};


const resolutionTime = async (q: DashboardQuery) => {
  const where: Prisma.ServiceRequestWhereInput = {
    ...baseWhere(q),
    resolvedAt: { not: null },
    status: { in: ["RESOLVED", "CLOSED"] },
  };

  const resolved = await prisma.serviceRequest.findMany({
    where,
    select: { createdAt: true, resolvedAt: true },
  });

  if (resolved.length === 0) {
    return { count: 0, avgHours: 0, minHours: 0, maxHours: 0 };
  }

  const durations = resolved.map((r) => {
    const ms = (r.resolvedAt?.getTime() ?? 0) - r.createdAt.getTime();
    return ms / (1000 * 60 * 60);
  });

  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    count: durations.length,
    avgHours: Math.round((sum / durations.length) * 100) / 100,
    minHours: Math.round(Math.min(...durations) * 100) / 100,
    maxHours: Math.round(Math.max(...durations) * 100) / 100,
  };
};


const paymentSummary = async (q: DashboardQuery) => {
  const paymentWhere: Prisma.PaymentWhereInput = {};
  if (q.from || q.to) {
    paymentWhere.createdAt = {};
    if (q.from) paymentWhere.createdAt.gte = q.from;
    if (q.to) paymentWhere.createdAt.lte = q.to;
  }

  const [completed, pending, failed] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...paymentWhere, status: "COMPLETED" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { ...paymentWhere, status: "PENDING" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { ...paymentWhere, status: "FAILED" },
      _count: { id: true },
    }),
  ]);

  return {
    completed: {
      count: completed._count.id,
      totalAmount: completed._sum.amount?.toString() ?? "0",
    },
    pending: {
      count: pending._count.id,
      totalAmount: pending._sum.amount?.toString() ?? "0",
    },
    failed: {
      count: failed._count.id,
    },
  };
};

const getAdminDashboard = async (q: DashboardQuery) => {
  const [
    statusBreakdown,
    categoryBreakdown,
    departmentBreakdown,
    sla,
    resolution,
    payments,
  ] = await Promise.all([
    requestsByStatus(q),
    requestsByCategory(q),
    requestsByDepartment(q),
    slaBreaches(q),
    resolutionTime(q),
    paymentSummary(q),
  ]);

  return {
    statusBreakdown: statusBreakdown.map((r) => ({
      status: r.status,
      count: r._count.id,
    })),
    categoryBreakdown,
    departmentBreakdown,
    sla,
    resolution,
    payments,
  };
};

const getPublicStats = async () => {
  const where: Prisma.ServiceRequestWhereInput = { isDeleted: false };

  const [
    totalRequests,
    resolvedCount,
    statusRows,
    avgResolution,
    breachedCount,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.count({
      where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.serviceRequest.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    }),
    prisma.serviceRequest
      .findMany({
        where: {
          ...where,
          resolvedAt: { not: null },
          status: { in: ["RESOLVED", "CLOSED"] },
        },
        select: { createdAt: true, resolvedAt: true },
      })
      .then((rows) => {
        if (rows.length === 0) return 0;
        const total = rows.reduce(
          (acc, r) =>
            acc + ((r.resolvedAt?.getTime() ?? 0) - r.createdAt.getTime()),
          0,
        );
        return Math.round(total / rows.length / (1000 * 60 * 60) * 100) / 100;
      }),
    prisma.serviceRequest.count({
      where: { ...where, slaBreachedAt: { not: null } },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of statusRows) {
    statusMap[row.status] = row._count.id;
  }

  return {
    totalRequests,
    resolvedRequests: resolvedCount,
    resolutionRate:
      totalRequests > 0
        ? Math.round((resolvedCount / totalRequests) * 10000) / 100
        : 0,
    avgResolutionTimeHours: avgResolution,
    slaComplianceRate:
      totalRequests > 0
        ? Math.round(
            ((totalRequests - breachedCount) / totalRequests) * 10000,
          ) / 100
        : 100,
    statusBreakdown: statusMap,
  };
};

export const dashboardServices = {
  getAdminDashboard,
  getPublicStats,
};
