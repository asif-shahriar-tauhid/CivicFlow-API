import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../interfaces";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { attachmentServices } from "./attachment.service";

const currentUser = (req: Request): RequestUser => {
  if (!req.user)
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
  return req.user;
};

const addAttachment = catchAsync(async (req: Request, res: Response) => {
  if (!req.file)
    throw new AppError(httpStatus.BAD_REQUEST, "Evidence file is required.");
  const data = await attachmentServices.addAttachment(
    req.params.requestId as string,
    req.file,
    req.body?.caption,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attachment uploaded successfully.",
    data,
  });
});

const listAttachments = catchAsync(async (req: Request, res: Response) => {
  const data = await attachmentServices.listAttachments(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachments retrieved successfully.",
    data,
  });
});

const getAttachment = catchAsync(async (req: Request, res: Response) => {
  const data = await attachmentServices.getAttachment(
    req.params.requestId as string,
    req.params.attachmentId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment retrieved successfully.",
    data,
  });
});

const deleteAttachment = catchAsync(async (req: Request, res: Response) => {
  const data = await attachmentServices.deleteAttachment(
    req.params.requestId as string,
    req.params.attachmentId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment deleted successfully.",
    data,
  });
});

export const attachmentController = {
  addAttachment,
  listAttachments,
  getAttachment,
  deleteAttachment,
};
