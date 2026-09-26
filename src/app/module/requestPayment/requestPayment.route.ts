import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { requestPaymentController } from "./requestPayment.controller";

const router = Router();

router.get("/bkash/callback/:result", requestPaymentController.callback);
router.post("/bkash/callback/:result", requestPaymentController.callback);
router.post(
  "/requests/:requestId/initiate",
  auth(Role.CITIZEN),
  requestPaymentController.initiate,
);
router.get(
  "/:paymentId/status",
  auth(Role.ADMIN, Role.STAFF, Role.CITIZEN),
  requestPaymentController.status,
);

export const RequestPaymentRoutes = router;
