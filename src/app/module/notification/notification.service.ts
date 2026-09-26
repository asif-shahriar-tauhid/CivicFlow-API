import type { Prisma } from "../../../generated/prisma/client";
import { transporter } from "../../lib/nodemailer";
import { redisClient } from "../../lib/redis";
import { prisma } from "../../lib/prisma";
import type {
  NotificationEventKey,
  NotificationMetadata,
} from "./notification.interface";

export const notificationEventId = (
  eventKey: NotificationEventKey,
  eventId: string,
) => `${eventKey}:${eventId}`;

export const notificationIdentity = (
  recipientId: string,
  eventKey: NotificationEventKey,
  eventId: string,
) => `${recipientId}:${notificationEventId(eventKey, eventId)}`;

export const canReadNotification = (recipientId: string, userId: string) =>
  recipientId === userId;

type CreateNotificationInput = {
  recipientId: string;
  eventKey: NotificationEventKey;
  eventId: string;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  sendEmail?: boolean;
};

const deliverEmail = async (
  notificationId: string,
  recipientId: string,
  title: string,
  message: string,
) => {
  if (!configEmailEnabled()) return;
  const deliveryKey = `notification:email:${notificationId}`;
  if (redisClient.isOpen) {
    const claimed = await redisClient.set(deliveryKey, "sending", {
      NX: true,
      EX: 300,
    });
    if (!claimed) return;
  }
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });
    if (!recipient?.email) return;
    await transporter.sendMail({
      from: process.env.EMAIL_SENDER,
      to: recipient.email,
      subject: title,
      text: message,
    });
    if (redisClient.isOpen)
      await redisClient.set(deliveryKey, "delivered", { EX: 86400 });
  } catch (error) {
    if (redisClient.isOpen) await redisClient.del(deliveryKey);
    console.error("Notification email delivery failed:", error);
  }
};

const configEmailEnabled = () =>
  Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

const createNotification = async (input: CreateNotificationInput) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        eventKey: input.eventKey,
        eventId: input.eventId,
        title: input.title,
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    if (input.sendEmail) {
      void deliverEmail(
        notification.id,
        input.recipientId,
        input.title,
        input.message,
      );
    }
    return notification;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const existing = await prisma.notification.findFirstOrThrow({
        where: {
          recipientId: input.recipientId,
          eventKey: input.eventKey,
          eventId: input.eventId,
        },
      });
      if (input.sendEmail) {
        void deliverEmail(
          existing.id,
          input.recipientId,
          input.title,
          input.message,
        );
      }
      return existing;
    }
    throw error;
  }
};

const listMine = async (userId: string, page = 1, limit = 20) => {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const where = { recipientId: userId };
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
  ]);
  return {
    data,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

const markRead = async (notificationId: string, userId: string) =>
  prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });

const unreadCount = (userId: string) =>
  prisma.notification.count({ where: { recipientId: userId, readAt: null } });

export const notificationServices = {
  createNotification,
  listMine,
  markRead,
  unreadCount,
  deliverEmail,
  notificationEventId,
  notificationIdentity,
};
