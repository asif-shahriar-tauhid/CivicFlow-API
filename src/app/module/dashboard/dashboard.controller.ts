import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { dashboardServices } from "./dashboard.service";
import type { DashboardQuery } from "./dashboard.validation";

const getAdminDashboard = catchAsync(async (req: Request, res: Response) => {
  const data = await dashboardServices.getAdminDashboard(
    req.query as unknown as DashboardQuery,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin dashboard retrieved successfully.",
    data,
  });
});

const getPublicStats = catchAsync(async (_req: Request, res: Response) => {
  const data = await dashboardServices.getPublicStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Public statistics retrieved successfully.",
    data,
  });
});

export const dashboardController = {
  getAdminDashboard,
  getPublicStats,
};
