import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { paymentController } from "./payment.controller";

const router = Router();

router.get("/my-payments", auth(Role.CITIZEN), paymentController.getMyPayments);

router.get("all-payments", auth(Role.ADMIN), paymentController.getAllPayments);

router.get(
  "/:paymentId",
  auth(Role.ADMIN, Role.CITIZEN, Role.STAFF),
  paymentController.getSinglePayment,
);

export const PaymentRoutes = router;
