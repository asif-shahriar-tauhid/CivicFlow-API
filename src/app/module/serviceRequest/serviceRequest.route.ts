import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { serviceRequestController } from "./serviceRequest.controller";
import { ServiceRequestValidation } from "./serviceRequest.validation";

const router = Router();
const requestRoles = [Role.CITIZEN, Role.STAFF, Role.ADMIN] as const;

router.post(
  "/",
  auth(...requestRoles),
  validateRequest(ServiceRequestValidation.createServiceRequestSchema),
  serviceRequestController.createServiceRequest,
);
router.get(
  "/",
  auth(...requestRoles),
  serviceRequestController.listServiceRequests,
);
router.get(
  "/:requestId",
  auth(...requestRoles),
  serviceRequestController.getServiceRequest,
);
router.patch(
  "/:requestId",
  auth(...requestRoles),
  validateRequest(ServiceRequestValidation.updateServiceRequestSchema),
  serviceRequestController.updateServiceRequest,
);
router.delete(
  "/:requestId",
  auth(...requestRoles),
  serviceRequestController.deleteServiceRequest,
);

export const ServiceRequestRoutes = router;
