import { notificationServices } from "./notification.service";
import type {
  NotificationEventKey,
  NotificationMetadata,
} from "./notification.interface";
import { NotificationEvent } from "./notification.interface";

type NotificationEventPayload = {
  recipientId: string;
  eventKey: NotificationEventKey;
  eventId: string;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  sendEmail?: boolean;
};

export const publishNotification = (event: NotificationEventPayload) => {
  void notificationServices.createNotification(event).catch((error) => {
    console.error("Notification event failed; retry is safe:", {
      eventKey: event.eventKey,
      eventId: event.eventId,
      recipientId: event.recipientId,
      error,
    });
  });
};

export const publishPaymentOutcome = (
  recipientId: string,
  paymentId: string,
  status: "COMPLETED" | "FAILED" | "REFUNDED",
) => {
  const eventKey = {
    COMPLETED: NotificationEvent.PAYMENT_COMPLETED,
    FAILED: NotificationEvent.PAYMENT_FAILED,
    REFUNDED: NotificationEvent.PAYMENT_REFUNDED,
  }[status];
  publishNotification({
    recipientId,
    eventKey,
    eventId: paymentId,
    title: `Payment ${status.toLowerCase()}`,
    message: `Your payment was ${status.toLowerCase()}.`,
    metadata: { paymentId, status },
    sendEmail: true,
  });
};
