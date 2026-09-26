import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { DepartmentRoutes } from "./app/module/department/department.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { ServiceRequestRoutes } from "./app/module/serviceRequest/serviceRequest.route";
import { SlaRoutes } from "./app/module/sla/sla.route";
import { UserRoutes } from "./app/module/user/user.route";
import { NotificationRoutes } from "./app/module/notification/notification.route";
import { RequestPaymentRoutes } from "./app/module/requestPayment/requestPayment.route";
import {
  requestFeedbackReportRoutes,
  requestFeedbackRoutes,
} from "./app/module/requestFeedback/requestFeedback.route";
import { AuditLogRoutes } from "./app/module/auditLog/auditLog.route";
import { DashboardRoutes } from "./app/module/dashboard/dashboard.route";

const app: Application = express();
app.use(cors({ origin: config.frontend_url, credentials: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) =>
  res
    .status(httpStatus.OK)
    .json({ success: true, message: "Welcome to CivicFlow." }),
);
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/departments", DepartmentRoutes);
app.use("/api/v1/requests", ServiceRequestRoutes);
app.use("/api/v1/requests", requestFeedbackRoutes);
app.use("/api/v1/request-feedback", requestFeedbackReportRoutes);
app.use("/api/v1/sla", SlaRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/request-payments", RequestPaymentRoutes);
app.use("/api/v1/audit-logs", AuditLogRoutes);
app.use("/api/v1/dashboard", DashboardRoutes);

app.use(globalErrorHandler);
app.use(notFound);

export default app;
