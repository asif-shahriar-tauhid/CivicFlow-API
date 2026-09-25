import crypto from "node:crypto";
import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  ICreateServiceRequestPayload,
  IRequestUser,
  IServiceRequestQuery,
  IUpdateServiceRequestPayload,
} from "./serviceRequest.interface";

const requestSelect = {
  id: true,
  requestNumber: true,
  title: true,
  description: true,
  caseType: true,
  status: true,
  priority: true,
  location: true,
  department: true,
  resolutionSummary: true,
  resolvedAt: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  citizen: { select: { id: true, name: true, email: true, userId: true } },
  category: { select: { id: true, name: true, description: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ServiceRequestSelect;

const parsePagination = (query: IServiceRequestQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const getCitizenId = async (
  user: IRequestUser,
  requestedCitizenId?: string,
) => {
  if (user.role !== Role.CITIZEN) {
    if (!requestedCitizenId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "A citizenId is required when staff or admin creates a request.",
      );
    }
    const citizen = await prisma.citizen.findUnique({
      where: { id: requestedCitizenId },
      select: { id: true, isDeleted: true },
    });
    if (!citizen || citizen.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, "Citizen profile not found.");
    }
    return citizen.id;
  }

  const citizen = await prisma.citizen.findUnique({
    where: { userId: user.userId },
    select: { id: true, isDeleted: true },
  });
  if (!citizen || citizen.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Citizen profile not found.");
  }
  return citizen.id;
};

const requestNumber = () =>
  `CIV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

const getRequest = async (requestId: string) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: requestSelect,
  });
  if (!request || request.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  }
  return request;
};

const assertCanAccess = (
  request: { citizen: { userId: string } },
  user: IRequestUser,
) => {
  if (user.role === Role.CITIZEN && request.citizen.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to access this request.",
    );
  }
};

const createServiceRequest = async (
  payload: ICreateServiceRequestPayload,
  user: IRequestUser,
) => {
  const citizenId = await getCitizenId(user, payload.citizenId);
  const { citizenId: _citizenId, categoryId, ...data } = payload;
  return prisma.serviceRequest.create({
    data: {
      ...data,
      requestNumber: requestNumber(),
      citizen: { connect: { id: citizenId } },
      category: categoryId ? { connect: { id: categoryId } } : undefined,
      createdBy: { connect: { id: user.userId } },
    },
    select: requestSelect,
  });
};

const listServiceRequests = async (
  query: IServiceRequestQuery,
  user: IRequestUser,
) => {
  const { page, limit, skip } = parsePagination(query);
  const sortFields = [
    "createdAt",
    "updatedAt",
    "priority",
    "status",
    "title",
  ] as const;
  const requestedSort = query.sortBy;
  const sortBy =
    requestedSort &&
    sortFields.includes(requestedSort as (typeof sortFields)[number])
      ? requestedSort
      : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const conditions: Prisma.ServiceRequestWhereInput[] = [{ isDeleted: false }];

  if (user.role === Role.CITIZEN)
    conditions.push({ citizen: { userId: user.userId } });
  if (query.searchTerm) {
    conditions.push({
      OR: [
        { title: { contains: query.searchTerm, mode: "insensitive" } },
        { description: { contains: query.searchTerm, mode: "insensitive" } },
        { requestNumber: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.caseType) conditions.push({ caseType: query.caseType });
  if (query.priority) conditions.push({ priority: query.priority });
  if (query.categoryId) conditions.push({ categoryId: query.categoryId });

  const where = { AND: conditions };
  const [data, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: requestSelect,
    }),
    prisma.serviceRequest.count({ where }),
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getServiceRequest = async (requestId: string, user: IRequestUser) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user);
  return request;
};

const updateServiceRequest = async (
  requestId: string,
  payload: IUpdateServiceRequestPayload,
  user: IRequestUser,
) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user);
  if (user.role === Role.CITIZEN && request.status !== "SUBMITTED") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only submitted requests can be edited by citizens.",
    );
  }

  const category =
    payload.categoryId === undefined
      ? undefined
      : payload.categoryId === null
        ? { disconnect: true }
        : { connect: { id: payload.categoryId } };
  const updateData: Prisma.ServiceRequestUpdateInput =
    user.role === Role.CITIZEN
      ? {
          title: payload.title,
          description: payload.description,
          location: payload.location,
          category,
        }
      : {
          title: payload.title,
          description: payload.description,
          caseType: payload.caseType,
          status: payload.status,
          priority: payload.priority,
          location: payload.location,
          department: payload.department,
          resolutionSummary: payload.resolutionSummary,
          category,
          resolvedAt: payload.status === "RESOLVED" ? new Date() : undefined,
        };

  return prisma.serviceRequest.update({
    where: { id: requestId },
    data: updateData,
    select: requestSelect,
  });
};

const deleteServiceRequest = async (requestId: string, user: IRequestUser) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user);
  if (user.role === Role.CITIZEN && request.status !== "SUBMITTED") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only submitted requests can be deleted by citizens.",
    );
  }
  return prisma.serviceRequest.update({
    where: { id: requestId },
    data: { isDeleted: true, deletedAt: new Date() },
    select: requestSelect,
  });
};

export const serviceRequestServices = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
};
