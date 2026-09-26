import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { CallbackResult } from "./requestPayment.interface";
import { requestPaymentServices } from "./requestPayment.service";
import { emitAuditLog, actorFromReq } from "../auditLog/auditLog.service";

const currentUser = (req: Request) => {
  if (!req.user)
    throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
  return req.user;
};

const callbackResult = (value: string): CallbackResult => {
  if (value !== "success" && value !== "cancel" && value !== "failure") {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment callback.");
  }
  return value;
};

const initiate = catchAsync(async (req: Request, res: Response) => {
  const data = await requestPaymentServices.initiate(
    req.params.requestId as string,
    currentUser(req),
  );
  emitAuditLog({
    ...actorFromReq(req),
    action: "PAYMENT_INITIATED",
    entity: "Payment",
    entityId: data.id,
    after: {
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      merchantInvoiceNumber: data.merchantInvoiceNumber,
      serviceRequestId: req.params.requestId,
    },
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Request payment initiated successfully.",
    data,
  });
});

const status = catchAsync(async (req: Request, res: Response) => {
  const data = await requestPaymentServices.getRequestPayment(
    req.params.paymentId as string,
    currentUser(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Request payment status retrieved successfully.",
    data,
  });
});

const callback = catchAsync(async (req: Request, res: Response) => {
  const paymentId = String(req.body?.paymentID || req.query.paymentID || "");
  if (!paymentId)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment identifier is required.",
    );
  const data = await requestPaymentServices.handleCallback(
    paymentId,
    callbackResult(req.params.result as string),
  );
  emitAuditLog({
    actorId: req.user?.userId ?? null,
    actorEmail: req.user?.email ?? null,
    req,
    action: "PAYMENT_RECONCILED",
    entity: "Payment",
    entityId: data.id,
    after: {
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      merchantInvoiceNumber: data.merchantInvoiceNumber,
    },
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment callback reconciled successfully.",
    data,
  });
});

export const requestPaymentController = { initiate, status, callback };
