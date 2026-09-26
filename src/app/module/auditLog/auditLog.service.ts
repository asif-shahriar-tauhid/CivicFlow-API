import type { Request } from "express";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

const REDACTED_FIELDS: ReadonlySet<string> = new Set([
  "password",
  "otp",
  "otpValue",
  "accessToken",
  "refreshToken",
  "token",
  "secret",
  "bkashAppKey",
  "bkashAppSecret",
  "bkashPassword",
  "bkashUsername",
  "gatewayResponse",
  "googleId",
  "idToken",
  "newPassword",
  "checkoutUrl",
]);

export const sanitise = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitise);
  if (typeof value === "object" && value !== null) {
    if (value instanceof Date) return value.toISOString();

    if (typeof (value as { toFixed?: unknown }).toFixed === "function") {
      return String(value);
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACTED_FIELDS.has(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitise(v);
      }
    }
    return result;
  }
  if (typeof value === "bigint") return value.toString();
  return value;
};

export interface AuditPayload {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  req?: Request;
}

export const emitAuditLog = (payload: AuditPayload): void => {
  const ipAddress =
    payload.req &&
    (String(
      payload.req.headers["x-forwarded-for"] ||
      payload.req.socket?.remoteAddress ||
      "",
    ) || undefined);
  const route =
    payload.req &&
    `${payload.req.method} ${payload.req.originalUrl || payload.req.url}`;
  const userAgent =
    payload.req &&
    (String(payload.req.headers["user-agent"] || "") || undefined);

  prisma.auditLog
    .create({
      data: {
        actorId: payload.actorId ?? null,
        actorEmail: payload.actorEmail ?? null,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        before: (sanitise(payload.before) as Prisma.InputJsonValue) ?? undefined,
        after: (sanitise(payload.after) as Prisma.InputJsonValue) ?? undefined,
        ipAddress: ipAddress || null,
        route: route || null,
        userAgent: userAgent || null,
      },
    })
    .catch((err) => {
      console.error("Failed to persist audit entry:", err);
    });
};

export const actorFromReq = (req: Request) => ({
  actorId: req.user?.userId ?? null,
  actorEmail: req.user?.email ?? null,
  req,
});
