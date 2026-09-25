import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../interfaces";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { serviceRequestServices } from "./serviceRequest.service";

const currentUser = (req: Request): RequestUser => {
  if (!req.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
  }
  return req.user;
};

const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.createServiceRequest(
    req.body,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Service request created successfully.",
    data,
  });
});

const listServiceRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await serviceRequestServices.listServiceRequests(
    req.query,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service requests retrieved successfully.",
    ...result,
  });
});

const getServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.getServiceRequest(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request retrieved successfully.",
    data,
  });
});

const updateServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.updateServiceRequest(
    req.params.requestId as string,
    req.body,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request updated successfully.",
    data,
  });
});

const deleteServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const data = await serviceRequestServices.deleteServiceRequest(
    req.params.requestId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request deleted successfully.",
    data,
  });
});

export const serviceRequestController = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
};
