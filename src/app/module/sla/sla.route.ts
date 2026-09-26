import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { slaController } from "./sla.controller";
import { SlaValidation } from "./sla.validation";

const router = Router();

router.get(
  "/overdue",
  auth(Role.ADMIN, Role.STAFF),
  validateRequest(SlaValidation.overdueQuerySchema, "query"),
  slaController.listOverdue,
);
router.patch(
  "/categories/:categoryId",
  auth(Role.ADMIN),
  validateRequest(SlaValidation.configSchema),
  slaController.configureCategory,
);
router.post(
  "/requests/:requestId/escalate",
  auth(Role.ADMIN, Role.STAFF),
  slaController.escalate,
);
router.post("/process", auth(Role.ADMIN), slaController.process);

export const SlaRoutes = router;
