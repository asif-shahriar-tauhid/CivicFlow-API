import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { notificationServices } from "./notification.service";

const currentUserId = (req: Request) => {
  if (!req.user)
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
  return req.user.userId;
};

const myNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.listMine(
    currentUserId(req),
    Number(req.query.page) || 1,
    Number(req.query.limit) || 20,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully.",
    ...result,
  });
});

const markRead = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.markRead(
    req.params.notificationId as string,
    currentUserId(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read.",
    data: result,
  });
});

const unreadCount = catchAsync(async (req: Request, res: Response) => {
  const data = {
    count: await notificationServices.unreadCount(currentUserId(req)),
  };
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread notification count retrieved successfully.",
    data,
  });
});

export const notificationController = {
  myNotifications,
  markRead,
  unreadCount,
};
