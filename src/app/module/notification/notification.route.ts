import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { notificationController } from "./notification.controller";

const router = Router();
router.get("/", auth(), notificationController.myNotifications);
router.get("/unread-count", auth(), notificationController.unreadCount);
router.patch("/:notificationId/read", auth(), notificationController.markRead);

export const NotificationRoutes = router;
