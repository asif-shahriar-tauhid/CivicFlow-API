import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../interfaces";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { requestFeedbackService } from "./requestFeedback.service";

const currentUser = (req: Request): RequestUser => {
  if (!req.user)
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
  return req.user;
};

const submitFeedback = catchAsync(async (req: Request, res: Response) => {
  const data = await requestFeedbackService.submitFeedback(
    req.params.requestId as string,
    req.body,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feedback submitted successfully.",
    data,
  });
});

const getMyFeedback = catchAsync(async (req: Request, res: Response) => {
  const data = await requestFeedbackService.getMyFeedback(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feedback retrieved successfully.",
    data,
  });
});

const getReport = catchAsync(async (req: Request, res: Response) => {
  const result = await requestFeedbackService.getReport(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feedback report retrieved successfully.",
    ...result,
  });
});

export const requestFeedbackController = {
  submitFeedback,
  getMyFeedback,
  getReport,
};
