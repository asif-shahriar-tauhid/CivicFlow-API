import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { auditLogController } from "./auditLog.controller";
import { auditLogQuerySchema } from "./auditLog.validation";

const router = Router();

router.get(
  "/",
  auth(Role.ADMIN),
  validateRequest(auditLogQuerySchema, "query"),
  auditLogController.listAuditLogs,
);

export const AuditLogRoutes = router;
