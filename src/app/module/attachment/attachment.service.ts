import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { deleteFromCloudinary, uploadToCloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../serviceRequest/serviceRequest.interface";

export const attachmentSelect = {
  id: true,
  requestId: true,
  url: true,
  publicId: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  format: true,
  resourceType: true,
  caption: true,
  uploaderId: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  uploader: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.RequestAttachmentSelect;

const getRequest = async (requestId: string) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      departmentId: true,
      isDeleted: true,
      citizen: { select: { userId: true } },
    },
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

const addAttachment = async (
  requestId: string,
  file: Express.Multer.File,
  caption: string | undefined,
  user: IRequestUser,
) => {
  const request = await getRequest(requestId);
  const staffDepartmentId = await getStaffDepartmentId(user);
  assertCanAccess(request, user, staffDepartmentId);
  if (
    user.role === Role.CITIZEN &&
    ["CLOSED", "RESOLVED", "REJECTED"].includes(request.status)
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Cannot add attachments to a closed, resolved, or rejected request.",
    );
  }

  const uploadResult = await uploadToCloudinary(file.buffer, {
    folder: "civicflow/evidence",
    resource_type: "auto",
  });
  try {
    return await prisma.$transaction((tx) =>
      tx.requestAttachment.create({
        data: {
          requestId,
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          format: uploadResult.format ?? null,
          resourceType: uploadResult.resource_type ?? "image",
          caption: caption?.trim() || null,
          uploaderId: user.userId,
        },
        select: attachmentSelect,
      }),
    );
  } catch (error) {
    await deleteFromCloudinary(
      uploadResult.public_id,
      uploadResult.resource_type ?? "image",
    );
    throw error;
  }
};

const listAttachments = async (requestId: string, user: IRequestUser) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user, await getStaffDepartmentId(user));
  return prisma.requestAttachment.findMany({
    where: { requestId, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: attachmentSelect,
  });
};

const getAttachment = async (
  requestId: string,
  attachmentId: string,
  user: IRequestUser,
) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user, await getStaffDepartmentId(user));
  const attachment = await prisma.requestAttachment.findFirst({
    where: { id: attachmentId, requestId, isDeleted: false },
    select: attachmentSelect,
  });
  if (!attachment)
    throw new AppError(httpStatus.NOT_FOUND, "Attachment not found.");
  return attachment;
};

const deleteAttachment = async (
  requestId: string,
  attachmentId: string,
  user: IRequestUser,
) => {
  const request = await getRequest(requestId);
  assertCanAccess(request, user, await getStaffDepartmentId(user));
  const attachment = await prisma.requestAttachment.findFirst({
    where: { id: attachmentId, requestId, isDeleted: false },
    select: {
      ...attachmentSelect,
      uploader: { select: { id: true, role: true } },
    },
  });
  if (!attachment)
    throw new AppError(httpStatus.NOT_FOUND, "Attachment not found.");
  if (
    user.role === Role.STAFF &&
    (attachment.uploader.role === Role.CITIZEN ||
      attachment.uploaderId !== user.userId)
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Staff can only delete their own non-citizen evidence.",
    );
  }
  if (
    user.role === Role.CITIZEN &&
    (attachment.uploaderId !== user.userId || request.status !== "SUBMITTED")
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Citizen evidence can only be deleted while the request is submitted and owned by you.",
    );
  }
  return prisma.requestAttachment.update({
    where: { id: attachmentId },
    data: { isDeleted: true, deletedAt: new Date() },
    select: attachmentSelect,
  });
};

export const attachmentServices = {
  addAttachment,
  listAttachments,
  getAttachment,
  deleteAttachment,
};
