import type { Role } from "../../../generated/prisma/enums";

export type NotificationEventKey =
  | "REQUEST_SUBMITTED"
  | "REQUEST_STATUS_CHANGED"
  | "REQUEST_ASSIGNED"
  | "REQUEST_ACTION_REQUIRED"
  | "REQUEST_RESOLVED"
  | "REQUEST_REOPENED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "SLA_BREACHED";

export const NotificationEvent = {
  REQUEST_SUBMITTED: "REQUEST_SUBMITTED",
  REQUEST_STATUS_CHANGED: "REQUEST_STATUS_CHANGED",
  REQUEST_ASSIGNED: "REQUEST_ASSIGNED",
  REQUEST_ACTION_REQUIRED: "REQUEST_ACTION_REQUIRED",
  REQUEST_RESOLVED: "REQUEST_RESOLVED",
  REQUEST_REOPENED: "REQUEST_REOPENED",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_REFUNDED: "PAYMENT_REFUNDED",
  SLA_BREACHED: "SLA_BREACHED",
} as const satisfies Record<NotificationEventKey, NotificationEventKey>;

export type NotificationMetadata = Record<string, string | number | null>;

export interface NotificationUser {
  userId: string;
  role: Role;
}
