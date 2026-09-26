import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { departmentController } from "./department.controller";
import { DepartmentValidation } from "./department.validation";

const router = Router();
const adminOnly = auth(Role.ADMIN);

router.get("/", adminOnly, departmentController.listDepartments);
router.post(
  "/",
  adminOnly,
  validateRequest(DepartmentValidation.createDepartmentSchema),
  departmentController.createDepartment,
);
router.patch(
  "/:departmentId/archive",
  adminOnly,
  departmentController.archiveDepartment,
);
router.patch(
  "/staff/:userId/department",
  adminOnly,
  validateRequest(DepartmentValidation.assignStaffDepartmentSchema),
  departmentController.assignStaffDepartment,
);
router.get("/routing-rules", adminOnly, departmentController.listRoutingRules);
router.post(
  "/routing-rules",
  adminOnly,
  validateRequest(DepartmentValidation.createRoutingRuleSchema),
  departmentController.createRoutingRule,
);
router.patch(
  "/routing-rules/:ruleId/archive",
  adminOnly,
  departmentController.archiveRoutingRule,
);

export const DepartmentRoutes = router;
