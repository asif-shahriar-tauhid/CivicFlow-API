import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { UserServices } from "./user.service";
import { sendResponse } from "../../utils/sendResponse";
import { emitAuditLog, actorFromReq } from "../auditLog/auditLog.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No File Provided.");
  }

  const userId = req.user?.userId;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User not authenticated.");
  }

  const result = await UserServices.uploadProfileImage(
    req.file?.buffer,
    userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image updated successfully.",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllUsers(
    req.query as Parameters<typeof UserServices.getAllUsers>[0],
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully.",
    ...result,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const data = await UserServices.getUserById(req.params.userId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User retrieved successfully.",
    data,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const result = await UserServices.updateUser(userId, req.body);

  const action = req.body.role
    ? "USER_ROLE_CHANGED"
    : req.body.status
      ? "USER_STATUS_CHANGED"
      : "USER_UPDATED";

  emitAuditLog({
    ...actorFromReq(req),
    action,
    entity: "User",
    entityId: userId,
    before: {
      role: result.before.role,
      status: result.before.status,
      departmentId: result.before.departmentId,
    },
    after: {
      role: result.after.role,
      status: result.after.status,
      departmentId: result.after.departmentId,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User updated successfully.",
    data: result.after,
  });
});

const softDeleteUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const result = await UserServices.softDeleteUser(userId);

  emitAuditLog({
    ...actorFromReq(req),
    action: "USER_SOFT_DELETED",
    entity: "User",
    entityId: userId,
    before: { isDeleted: result.before.isDeleted, status: result.before.status },
    after: { isDeleted: result.after.isDeleted, status: result.after.status },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User soft-deleted successfully.",
    data: result.after,
  });
});

export const UserController = {
  uploadProfileImage,
  getAllUsers,
  getUserById,
  updateUser,
  softDeleteUser,
};
