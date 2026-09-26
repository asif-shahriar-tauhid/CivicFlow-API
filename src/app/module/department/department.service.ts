import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  IAssignStaffDepartmentPayload,
  ICreateDepartmentPayload,
  ICreateRoutingRulePayload,
  IDepartmentQuery,
} from "./department.interface";

const listDepartments = async (query: IDepartmentQuery) => {
  const includeArchived = query.includeArchived === "true";
  return prisma.department.findMany({
    where: includeArchived ? undefined : { isArchived: false },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { routingRules: true, serviceRequests: true } },
    },
  });
};

const createDepartment = async (payload: ICreateDepartmentPayload) =>
  prisma.department.create({ data: payload });

const archiveDepartment = async (departmentId: string) => {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, isArchived: true },
  });
  if (!department || department.isArchived) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.categoryRoutingRule.updateMany({
      where: { departmentId, isArchived: false },
      data: { isArchived: true, isActive: false, archivedAt: new Date() },
    });
    return tx.department.update({
      where: { id: departmentId },
      data: { isArchived: true, isActive: false, archivedAt: new Date() },
    });
  });
};

const listRoutingRules = async (query: IDepartmentQuery) =>
  prisma.categoryRoutingRule.findMany({
    where: query.includeArchived === "true" ? undefined : { isArchived: false },
    orderBy: [{ category: { name: "asc" } }, { priority: "desc" }],
    include: {
      category: { select: { id: true, name: true } },
      department: {
        select: { id: true, name: true, isActive: true, isArchived: true },
      },
    },
  });

const createRoutingRule = async (payload: ICreateRoutingRulePayload) => {
  const [category, department] = await Promise.all([
    prisma.requestCategory.findUnique({
      where: { id: payload.categoryId },
      select: { id: true, isActive: true },
    }),
    prisma.department.findUnique({
      where: { id: payload.departmentId },
      select: { id: true, isActive: true, isArchived: true },
    }),
  ]);
  if (!category?.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The request category is inactive or missing.",
    );
  }
  if (!department?.isActive || department.isArchived) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The department is inactive or archived.",
    );
  }

  return prisma.categoryRoutingRule.create({
    data: {
      ...payload,
      location: payload.location || null,
    },
    include: {
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
};

const archiveRoutingRule = async (ruleId: string) => {
  const rule = await prisma.categoryRoutingRule.findUnique({
    where: { id: ruleId },
    select: { id: true, isArchived: true },
  });
  if (!rule || rule.isArchived) {
    throw new AppError(httpStatus.NOT_FOUND, "Routing rule not found.");
  }
  return prisma.categoryRoutingRule.update({
    where: { id: ruleId },
    data: { isArchived: true, isActive: false, archivedAt: new Date() },
  });
};

const assignStaffDepartment = async (
  userId: string,
  payload: IAssignStaffDepartmentPayload,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isDeleted: true },
  });
  if (!user || user.isDeleted || user.role !== "STAFF") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only active staff users can be assigned to a department.",
    );
  }
  if (payload.departmentId) {
    const department = await prisma.department.findFirst({
      where: {
        id: payload.departmentId,
        isActive: true,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!department) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "The department is inactive or archived.",
      );
    }
  }
  return prisma.user.update({
    where: { id: userId },
    data: { departmentId: payload.departmentId },
    select: { id: true, name: true, email: true, role: true, department: true },
  });
};

export const departmentServices = {
  listDepartments,
  createDepartment,
  archiveDepartment,
  listRoutingRules,
  createRoutingRule,
  archiveRoutingRule,
  assignStaffDepartment,
};
