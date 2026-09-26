import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { attachmentUpload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import {
  validateAttachmentFile,
  validateOptionalAttachmentFiles,
} from "../../middleware/validateAttachment";
import { validateRequest } from "../../middleware/validateRequest";
import { serviceRequestController } from "./serviceRequest.controller";
import { ServiceRequestValidation } from "./serviceRequest.validation";
import { attachmentController } from "../attachment/attachment.controller";

const router = Router();
const requestRoles = [Role.CITIZEN, Role.STAFF, Role.ADMIN] as const;

router.get(
  "/queue/me",
  auth(Role.STAFF),
  validateRequest(ServiceRequestValidation.queueQuerySchema, "query"),
  serviceRequestController.myQueue,
);
router.get(
  "/queue/department",
  auth(Role.STAFF),
  validateRequest(ServiceRequestValidation.queueQuerySchema, "query"),
  serviceRequestController.departmentQueue,
);

router.post(
  "/",
  auth(...requestRoles),
  attachmentUpload.array("files", 5),
  validateOptionalAttachmentFiles,
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
router.post(
  "/:requestId/transition",
  auth(Role.ADMIN, Role.STAFF),
  validateRequest(ServiceRequestValidation.transitionSchema),
  serviceRequestController.transitionServiceRequest,
);
router.post(
  "/:requestId/notes",
  auth(Role.ADMIN, Role.STAFF),
  validateRequest(ServiceRequestValidation.noteSchema),
  serviceRequestController.addInvestigationNote,
);
router.post(
  "/:requestId/resolve",
  auth(Role.ADMIN, Role.STAFF),
  validateRequest(ServiceRequestValidation.resolutionSchema),
  serviceRequestController.resolveServiceRequest,
);
router.post(
  "/:requestId/confirm",
  auth(Role.CITIZEN),
  serviceRequestController.confirmServiceRequest,
);
router.post(
  "/:requestId/reopen",
  auth(Role.CITIZEN),
  validateRequest(ServiceRequestValidation.reopenSchema),
  serviceRequestController.reopenServiceRequest,
);
router.delete(
  "/:requestId",
  auth(...requestRoles),
  serviceRequestController.deleteServiceRequest,
);
router.post(
  "/:requestId/route",
  auth(Role.ADMIN),
  serviceRequestController.routeServiceRequest,
);
router.post(
  "/:requestId/assign",
  auth(Role.ADMIN, Role.STAFF),
  validateRequest(ServiceRequestValidation.assignmentSchema),
  serviceRequestController.assignServiceRequest,
);
router.post(
  "/:requestId/reassign",
  auth(Role.ADMIN, Role.STAFF),
  validateRequest(ServiceRequestValidation.assignmentSchema),
  serviceRequestController.reassignServiceRequest,
);

// Evidence attachment routes
router.post(
  "/:requestId/attachments",
  auth(...requestRoles),
  attachmentUpload.single("file"),
  validateAttachmentFile,
  validateRequest(ServiceRequestValidation.createAttachmentSchema),
  attachmentController.addAttachment,
);
router.get(
  "/:requestId/attachments",
  auth(...requestRoles),
  attachmentController.listAttachments,
);
router.get(
  "/:requestId/attachments/:attachmentId",
  auth(...requestRoles),
  attachmentController.getAttachment,
);
router.delete(
  "/:requestId/attachments/:attachmentId",
  auth(...requestRoles),
  attachmentController.deleteAttachment,
);

export const ServiceRequestRoutes = router;
