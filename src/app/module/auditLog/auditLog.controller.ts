import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { auditLogQueryService } from "./auditLog.query";
import type { AuditLogQuery } from "./auditLog.validation";

const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await auditLogQueryService.listAuditLogs(
    req.query as unknown as AuditLogQuery,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved successfully.",
    ...result,
  });
});

export const auditLogController = {
  listAuditLogs,
};
