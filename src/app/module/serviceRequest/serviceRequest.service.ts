import crypto from "node:crypto";
import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { deleteFromCloudinary, uploadToCloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  ICreateServiceRequestPayload,
  IAssignmentPayload,
  IRequestUser,
  IServiceRequestQuery,
  IUpdateServiceRequestPayload,
} from "./serviceRequest.interface";
import { attachmentSelect } from "../attachment/attachment.service";

const requestSelect = {
  id: true,
  requestNumber: true,
  title: true,
  description: true,
  caseType: true,
  status: true,
  priority: true,
  location: true,
  address: true,
  ward: true,
  zone: true,
  landmark: true,
  latitude: true,
  longitude: true,
  routingStatus: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  resolutionSummary: true,
  resolvedAt: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  citizen: { select: { id: true, name: true, email: true, userId: true } },
  category: { select: { id: true, name: true, description: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
    },
  },
  assignments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      previousAssigneeId: true,
      createdAt: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true, email: true } },
    },
  },
  attachments: {
    where: { isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: attachmentSelect,
  },
  statusHistory: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      from: true,
      to: true,
      reason: true,
      actorId: true,
      createdAt: true,
    },
  },
  investigationNotes: {
    orderBy: { createdAt: "asc" },
    select: { id: true, note: true, actorId: true, createdAt: true },
  },
  resolutions: {
    orderBy: { createdAt: "asc" },
    select: { id: true, reason: true, actorId: true, createdAt: true },
  },
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

const getStaffDepartmentId = async (user: IRequestUser) => {
  if (user.role !== Role.STAFF) return undefined;
  const staff = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { departmentId: true },
  });
  if (!staff?.departmentId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your staff account is not assigned to a department.",
    );
  }
  const department = await prisma.department.findFirst({
    where: { id: staff.departmentId, isActive: true, isArchived: false },
    select: { id: true },
  });
  if (!department) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your department is inactive or archived.",
    );
  }
  return department.id;
};

const assertCanAccess = (
  request: { citizen: { userId: string }; departmentId: string | null },
  user: IRequestUser,
  staffDepartmentId?: string,
) => {
  if (user.role === Role.CITIZEN && request.citizen.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to access this request.",
    );
  }
  if (user.role === Role.STAFF && request.departmentId !== staffDepartmentId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to access requests outside your department.",
    );
  }
};

type RoutingClient = Prisma.TransactionClient;

const findRoutingRule = async (
  client: RoutingClient,
  categoryId: string | null,
  location: string | null,
  ward?: string | null,
  zone?: string | null,
) => {
  if (!categoryId) return null;
  const baseWhere = {
    categoryId,
    isActive: true,
    isArchived: false,
    department: { isActive: true, isArchived: false },
  } as const;

  const candidateLocations = [
    location?.trim(),
    ward?.trim(),
    zone?.trim(),
  ].filter((loc): loc is string => Boolean(loc && loc.length > 0));

  for (const loc of candidateLocations) {
    const exactRule = await client.categoryRoutingRule.findFirst({
      where: { ...baseWhere, location: loc },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      select: { departmentId: true },
    });
    if (exactRule) return exactRule;
  }

  return client.categoryRoutingRule.findFirst({
    where: { ...baseWhere, location: null },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { departmentId: true },
  });
};

const assertActiveCategory = async (
  client: RoutingClient,
  categoryId?: string | null,
) => {
  if (!categoryId) return;
  const category = await client.requestCategory.findUnique({
    where: { id: categoryId },
    select: { isActive: true },
  });
  if (!category?.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The request category is inactive or missing.",
    );
  }
};

const routeRequestInTransaction = async (
  tx: RoutingClient,
  requestId: string,
  changedById: string,
  reason: string,
  alwaysAudit = false,
) => {
  const request = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      categoryId: true,
      location: true,
      ward: true,
      zone: true,
      departmentId: true,
      routingStatus: true,
      isDeleted: true,
    },
  });
  if (!request || request.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
  }
  const rule = await findRoutingRule(
    tx,
    request.categoryId,
    request.location,
    request.ward,
    request.zone,
  );
  const departmentId = rule?.departmentId ?? null;
  const routingStatus = departmentId ? "ASSIGNED" : "MANUAL_REVIEW";
  const changed =
    request.departmentId !== departmentId ||
    request.routingStatus !== routingStatus;

  if (changed || alwaysAudit) {
    await tx.requestRoutingAudit.create({
      data: {
        requestId,
        fromDepartmentId: request.departmentId,
        toDepartmentId: departmentId,
        categoryId: request.categoryId,
        location: request.location ?? request.ward ?? request.zone ?? null,
        routingStatus,
        reason,
        changedById,
      },
    });
  }

  return tx.serviceRequest.update({
    where: { id: requestId },
    data: { departmentId, routingStatus },
    select: requestSelect,
  });
};

const createServiceRequest = async (
  payload: ICreateServiceRequestPayload,
  user: IRequestUser,
  files?: Express.Multer.File[],
) => {
  const citizenId = await getCitizenId(user, payload.citizenId);
  const staffDepartmentId = await getStaffDepartmentId(user);
  const { citizenId: _citizenId, categoryId, ...data } = payload;

  const uploadedAssets: { publicId: string; resourceType: string }[] = [];

  const fileUploadPromises = (files || []).map(async (file) => {
    const uploaded = await uploadToCloudinary(file.buffer, {
      folder: "civicflow/evidence",
      resource_type: "auto",
    });
    uploadedAssets.push({
      publicId: uploaded.public_id,
      resourceType: uploaded.resource_type || "image",
    });
    return {
      file,
      uploaded,
    };
  });

  let uploadResults: {
    file: Express.Multer.File;
    uploaded: UploadApiResponse;
  }[] = [];
  try {
    uploadResults = await Promise.all(fileUploadPromises);
  } catch (uploadError) {
    await Promise.all(
      uploadedAssets.map((asset) =>
        deleteFromCloudinary(asset.publicId, asset.resourceType),
      ),
    );
    throw uploadError;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await assertActiveCategory(tx, categoryId);
      const request = await tx.serviceRequest.create({
        data: {
          ...data,
          requestNumber: requestNumber(),
          citizen: { connect: { id: citizenId } },
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          createdBy: { connect: { id: user.userId } },
          attachments:
            uploadResults.length > 0
              ? {
                  create: uploadResults.map(({ file, uploaded }) => ({
                    url: uploaded.secure_url,
                    publicId: uploaded.public_id,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    format: uploaded.format ?? null,
                    resourceType: uploaded.resource_type ?? "image",
                    uploaderId: user.userId,
                  })),
                }
              : undefined,
        },
        select: { id: true },
      });
      await tx.requestStatusHistory.create({
        data: {
          requestId: request.id,
          from: null,
          to: "SUBMITTED",
          reason: "Request submitted.",
          actorId: user.userId,
        },
      });

      const routed = await routeRequestInTransaction(
        tx,
        request.id,
        user.userId,
        "Initial request routing",
        true,
      );

      if (
        user.role === Role.STAFF &&
        routed.departmentId !== staffDepartmentId
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "The request does not route to your department.",
        );
      }

      return routed;
    });
  } catch (error) {
    await Promise.all(
      uploadedAssets.map((asset) =>
        deleteFromCloudinary(asset.publicId, asset.resourceType),
      ),
    );
    throw error;
  }
};

const listServiceRequests = async (
  query: IServiceRequestQuery,
  user: IRequestUser,
) => {
  const { page, limit, skip } = parsePagination(query);
  const staffDepartmentId = await getStaffDepartmentId(user);
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
  if (user.role === Role.STAFF)
    conditions.push({ departmentId: staffDepartmentId });
  if (query.searchTerm) {
    conditions.push({
      OR: [
        { title: { contains: query.searchTerm, mode: "insensitive" } },
        { description: { contains: query.searchTerm, mode: "insensitive" } },
        { requestNumber: { contains: query.searchTerm, mode: "insensitive" } },
        { address: { contains: query.searchTerm, mode: "insensitive" } },
        { landmark: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.caseType) conditions.push({ caseType: query.caseType });
  if (query.priority) conditions.push({ priority: query.priority });
  if (query.categoryId) conditions.push({ categoryId: query.categoryId });
  if (query.departmentId) conditions.push({ departmentId: query.departmentId });
  if (query.ward) conditions.push({ ward: query.ward });
  if (query.zone) conditions.push({ zone: query.zone });

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

const getQueue = async (
  query: IServiceRequestQuery,
  user: IRequestUser,
  departmentOnly: boolean,
) => {
  const { page, limit, skip } = parsePagination(query);
  const staffDepartmentId = await getStaffDepartmentId(user);
  const sortFields = [
    "createdAt",
    "updatedAt",
    "priority",
    "status",
    "title",
  ] as const;
  const sortBy = sortFields.includes(
    query.sortBy as (typeof sortFields)[number],
  )
    ? (query.sortBy as (typeof sortFields)[number])
    : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const conditions: Prisma.ServiceRequestWhereInput[] = [
    { isDeleted: false, assignedToId: { not: null } },
  ];
  if (departmentOnly || user.role === Role.STAFF)
    conditions.push({ departmentId: staffDepartmentId });
  if (!departmentOnly) conditions.push({ assignedToId: user.userId });
  if (query.assignedToId) conditions.push({ assignedToId: query.assignedToId });
  if (query.status) conditions.push({ status: query.status });
  if (query.priority) conditions.push({ priority: query.priority });
  if (query.searchTerm) {
    conditions.push({
      OR: [
        { title: { contains: query.searchTerm, mode: "insensitive" } },
        { requestNumber: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }
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

const assignRequest = async (
  requestId: string,
  payload: IAssignmentPayload,
  user: IRequestUser,
  allowReassign: boolean,
) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        departmentId: true,
        assignedToId: true,
        status: true,
        isDeleted: true,
      },
    });
    if (!request || request.isDeleted)
      throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
    if (!request.departmentId)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Request must belong to a department before assignment.",
      );
    const actor = await tx.user.findUnique({
      where: { id: user.userId },
      select: { departmentId: true },
    });
    if (
      user.role === Role.STAFF &&
      actor?.departmentId !== request.departmentId
    )
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You cannot assign requests outside your department.",
      );
    const assignee = await tx.user.findFirst({
      where: {
        id: payload.assignedToId,
        role: Role.STAFF,
        status: "ACTIVE",
        isDeleted: false,
        departmentId: request.departmentId,
      },
      select: { id: true },
    });
    if (!assignee)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Assignee must be an active staff member in the request department.",
      );
    if (request.assignedToId && !allowReassign)
      throw new AppError(
        httpStatus.CONFLICT,
        "Request is already assigned. Use reassign instead.",
      );
    if (!request.assignedToId && allowReassign)
      throw new AppError(
        httpStatus.CONFLICT,
        "Request has no existing assignee. Use assign instead.",
      );
    if (request.assignedToId === assignee.id)
      throw new AppError(
        httpStatus.CONFLICT,
        "Request is already assigned to this staff member.",
      );
    const action = request.assignedToId ? "REASSIGNED" : "ASSIGNED";
    const updated = await tx.serviceRequest.updateMany({
      where: { id: requestId, assignedToId: request.assignedToId },
      data: {
        assignedToId: assignee.id,
        routingStatus: "ASSIGNED",
      },
    });
    if (updated.count !== 1)
      throw new AppError(
        httpStatus.CONFLICT,
        "Request assignment changed. Please retry.",
      );
    await tx.requestAssignment.create({
      data: {
        requestId,
        assignedToId: assignee.id,
        assignedById: user.userId,
        previousAssigneeId: request.assignedToId,
        action,
      },
    });
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: requestSelect,
    });
  });
};

const getServiceRequest = async (requestId: string, user: IRequestUser) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user, await getStaffDepartmentId(user));
  return request;
};

const updateServiceRequest = async (
  requestId: string,
  payload: IUpdateServiceRequestPayload,
  user: IRequestUser,
) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user, await getStaffDepartmentId(user));
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
          address: payload.address,
          ward: payload.ward,
          zone: payload.zone,
          landmark: payload.landmark,
          latitude: payload.latitude,
          longitude: payload.longitude,
          category,
        }
      : user.role === Role.STAFF
        ? {
            title: payload.title,
            description: payload.description,
            priority: payload.priority,
            resolutionSummary: payload.resolutionSummary,
          }
        : {
            title: payload.title,
            description: payload.description,
            caseType: payload.caseType,
            priority: payload.priority,
            location: payload.location,
            address: payload.address,
            ward: payload.ward,
            zone: payload.zone,
            landmark: payload.landmark,
            latitude: payload.latitude,
            longitude: payload.longitude,
            resolutionSummary: payload.resolutionSummary,
            category,
          };

  const shouldReroute =
    user.role !== Role.STAFF &&
    (payload.categoryId !== undefined ||
      payload.location !== undefined ||
      payload.ward !== undefined ||
      payload.zone !== undefined);
  if (!shouldReroute) {
    return prisma.serviceRequest.update({
      where: { id: requestId },
      data: updateData,
      select: requestSelect,
    });
  }
  return prisma.$transaction(async (tx) => {
    await assertActiveCategory(tx, payload.categoryId);
    await tx.serviceRequest.update({
      where: { id: requestId },
      data: updateData,
      select: { id: true },
    });
    return routeRequestInTransaction(
      tx,
      requestId,
      user.userId,
      "Request category or location changed",
    );
  });
};

const deleteServiceRequest = async (requestId: string, user: IRequestUser) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user, await getStaffDepartmentId(user));
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

const routeServiceRequest = async (requestId: string, user: IRequestUser) =>
  prisma.$transaction((tx) =>
    routeRequestInTransaction(
      tx,
      requestId,
      user.userId,
      "Manual routing review",
      false,
    ),
  );

const assignServiceRequest = (
  requestId: string,
  payload: IAssignmentPayload,
  user: IRequestUser,
) => assignRequest(requestId, payload, user, false);

const reassignServiceRequest = (
  requestId: string,
  payload: IAssignmentPayload,
  user: IRequestUser,
) => assignRequest(requestId, payload, user, true);

const getMyQueue = (query: IServiceRequestQuery, user: IRequestUser) =>
  getQueue(query, user, false);

const getDepartmentQueue = (query: IServiceRequestQuery, user: IRequestUser) =>
  getQueue(query, user, true);

export const serviceRequestServices = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
  routeServiceRequest,
  assignServiceRequest,
  reassignServiceRequest,
  getMyQueue,
  getDepartmentQueue,
};
