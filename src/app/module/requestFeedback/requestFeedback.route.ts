import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { requestFeedbackController } from "./requestFeedback.controller";
import { RequestFeedbackValidation } from "./requestFeedback.validation";

const requestFeedbackRoutes = Router();
requestFeedbackRoutes.post(
  "/:requestId/feedback",
  auth(Role.CITIZEN),
  validateRequest(RequestFeedbackValidation.createFeedbackSchema),
  requestFeedbackController.submitFeedback,
);
requestFeedbackRoutes.get(
  "/:requestId/feedback",
  auth(Role.CITIZEN, Role.ADMIN),
  requestFeedbackController.getMyFeedback,
);

const requestFeedbackReportRoutes = Router();
requestFeedbackReportRoutes.get(
  "/report",
  auth(Role.ADMIN),
  validateRequest(RequestFeedbackValidation.reportQuerySchema, "query"),
  requestFeedbackController.getReport,
);

export { requestFeedbackRoutes, requestFeedbackReportRoutes };
