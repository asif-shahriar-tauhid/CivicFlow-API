import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { Request, Response } from "express";
import { paymentServices } from "./payment.service";
import { IQuery } from "../../interfaces";
import { sendResponse } from "../../utils/sendResponse";

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const { data, meta } = await paymentServices.getMyPayments(
    req.query as IQuery,
    user,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments Retrieved Successfully",
    data,
    meta,
  });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await paymentServices.getAllPayments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully",
    data,
    meta,
  });
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
  const paymentId = req.params.paymentId as string;
  const user = req.user!;

  const result = await paymentServices.getSinglePayment(paymentId, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment Retrieved Successfully",
    data: result,
  });
});

export const paymentController = {
  getMyPayments,
  getAllPayments,
  getSinglePayment,
};
