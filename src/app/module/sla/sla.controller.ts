import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { slaServices } from "./sla.service";

const currentUser = (req: Request) => req.user as RequestUser;

const listOverdue = catchAsync(async (req: Request, res: Response) => {
  const result = await slaServices.listOverdueRequests(
    req.query,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Overdue requests retrieved successfully.",
    ...result,
  });
});

const configureCategory = catchAsync(async (req: Request, res: Response) => {
  const data = await slaServices.configureCategorySla(
    req.params.categoryId as string,
    req.body,
    currentUser(req).userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category SLA configured successfully.",
    data,
  });
});

const escalate = catchAsync(async (req: Request, res: Response) => {
  const data = await slaServices.escalateRequest(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Request escalated successfully.",
    data,
  });
});

const process = catchAsync(async (req: Request, res: Response) => {
  const result = await slaServices.processBreaches(req.body.limit);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "SLA breaches processed successfully.",
    data: result,
  });
});

export const slaController = {
  listOverdue,
  configureCategory,
  escalate,
  process,
};
