import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { departmentServices } from "./department.service";
import { emitAuditLog, actorFromReq } from "../auditLog/auditLog.service";

const listDepartments = catchAsync(async (req: Request, res: Response) => {
  const data = await departmentServices.listDepartments(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Departments retrieved successfully.",
    data,
  });
});

const createDepartment = catchAsync(async (req: Request, res: Response) => {
  const data = await departmentServices.createDepartment(req.body);
  emitAuditLog({
    ...actorFromReq(req),
    action: "DEPARTMENT_CREATED",
    entity: "Department",
    entityId: data.id,
    after: data,
  });
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Department created successfully.",
    data,
  });
});

const archiveDepartment = catchAsync(async (req: Request, res: Response) => {
  const data = await departmentServices.archiveDepartment(
    req.params.departmentId as string,
  );
  emitAuditLog({
    ...actorFromReq(req),
    action: "DEPARTMENT_ARCHIVED",
    entity: "Department",
    entityId: req.params.departmentId as string,
    after: { isArchived: true, isActive: false },
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Department archived successfully.",
    data,
  });
});

const listRoutingRules = catchAsync(async (req: Request, res: Response) => {
  const data = await departmentServices.listRoutingRules(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Routing rules retrieved successfully.",
    data,
  });
});

const createRoutingRule = catchAsync(async (req: Request, res: Response) => {
  const data = await departmentServices.createRoutingRule(req.body);
  emitAuditLog({
    ...actorFromReq(req),
    action: "ROUTING_RULE_CREATED",
    entity: "CategoryRoutingRule",
    entityId: data.id,
    after: data,
  });
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Routing rule created successfully.",
    data,
  });
});

const archiveRoutingRule = catchAsync(async (req: Request, res: Response) => {
  const data = await departmentServices.archiveRoutingRule(
    req.params.ruleId as string,
  );
  emitAuditLog({
    ...actorFromReq(req),
    action: "ROUTING_RULE_ARCHIVED",
    entity: "CategoryRoutingRule",
    entityId: req.params.ruleId as string,
    after: { isArchived: true, isActive: false },
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Routing rule archived successfully.",
    data,
  });
});

const assignStaffDepartment = catchAsync(
  async (req: Request, res: Response) => {
    const data = await departmentServices.assignStaffDepartment(
      req.params.userId as string,
      req.body,
    );
    emitAuditLog({
      ...actorFromReq(req),
      action: "STAFF_DEPARTMENT_ASSIGNED",
      entity: "User",
      entityId: req.params.userId as string,
      after: { departmentId: req.body.departmentId },
    });
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Staff department assignment updated successfully.",
      data,
    });
  },
);

export const departmentController = {
  listDepartments,
  createDepartment,
  archiveDepartment,
  listRoutingRules,
  createRoutingRule,
  archiveRoutingRule,
  assignStaffDepartment,
};
