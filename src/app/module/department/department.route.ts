import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { departmentController } from "./department.controller";
import { DepartmentValidation } from "./department.validation";

const adminOnly = auth(Role.ADMIN);

// Dedicated routing rule router (mountable at /routing-rules or /departments/routing-rules)
const routingRuleRouter = Router();
routingRuleRouter.get("/", adminOnly, departmentController.listRoutingRules);
routingRuleRouter.post(
	"/",
	adminOnly,
	validateRequest(DepartmentValidation.createRoutingRuleSchema),
	departmentController.createRoutingRule,
);
routingRuleRouter.patch(
	"/:ruleId",
	adminOnly,
	validateRequest(DepartmentValidation.updateRoutingRuleSchema),
	departmentController.updateRoutingRule,
);
routingRuleRouter.patch(
	"/:ruleId/archive",
	adminOnly,
	departmentController.archiveRoutingRule,
);
routingRuleRouter.patch(
	"/:ruleId/unarchive",
	adminOnly,
	departmentController.unarchiveRoutingRule,
);

// Department router
const router = Router();
router.get("/", adminOnly, departmentController.listDepartments);
router.post(
	"/",
	adminOnly,
	validateRequest(DepartmentValidation.createDepartmentSchema),
	departmentController.createDepartment,
);
router.patch(
	"/:departmentId",
	adminOnly,
	validateRequest(DepartmentValidation.updateDepartmentSchema),
	departmentController.updateDepartment,
);
router.patch(
	"/:departmentId/archive",
	adminOnly,
	departmentController.archiveDepartment,
);
router.patch(
	"/:departmentId/unarchive",
	adminOnly,
	departmentController.unarchiveDepartment,
);
router.patch(
	"/staff/:userId/department",
	adminOnly,
	validateRequest(DepartmentValidation.assignStaffDepartmentSchema),
	departmentController.assignStaffDepartment,
);

router.get("/categories", adminOnly, departmentController.listCategories);

// Sub-mounted routing rules for backwards compatibility under /departments/routing-rules
router.use("/routing-rules", routingRuleRouter);

export const DepartmentRoutes = router;
export const RoutingRuleRoutes = routingRuleRouter;
