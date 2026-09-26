import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { dashboardController } from "./dashboard.controller";
import { dashboardQuerySchema } from "./dashboard.validation";

const router = Router();

router.get(
  "/admin",
  auth(Role.ADMIN),
  validateRequest(dashboardQuerySchema, "query"),
  dashboardController.getAdminDashboard,
);

router.get("/public/stats", dashboardController.getPublicStats);

export const DashboardRoutes = router;
