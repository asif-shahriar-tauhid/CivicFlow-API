import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { PaymentStatus, Role } from "../../../generated/prisma/enums";
import config from "../../config";
import {
  createBkashPayment,
  executeBkashPayment,
  queryBkashPayment,
} from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { publishPaymentOutcome } from "../notification/notification.events";
import { invoiceServices } from "../invoice/invoice.service";
import type { RequestUser } from "../../interfaces";
import type {
  CallbackResult,
  PaymentStatusView,
} from "./requestPayment.interface";

type ProviderPayment = {
  paymentID: string;
  transactionStatus: string;
  trxID?: string;
  amount?: string;
  currency?: string;
};

export const moneyInMinorUnits = (value: string | number) => {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment amount.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};

export const amountsMatch = (
  expected: string | number,
  actual: string | number,
) => moneyInMinorUnits(expected) === moneyInMinorUnits(actual);

export const mapProviderStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") return PaymentStatus.COMPLETED;
  if (normalized === "failed") return PaymentStatus.FAILED;
  if (["cancelled", "canceled"].includes(normalized))
    return PaymentStatus.CANCELLED;
  return PaymentStatus.PENDING;
};

export const nextPaymentStatus = (
  current: PaymentStatus,
  providerStatus: string,
) =>
  current === PaymentStatus.COMPLETED
    ? current
    : mapProviderStatus(providerStatus);

export const canViewRequestPayment = (
  role: Role,
  ownerId: string,
  userId: string,
) => role !== Role.CITIZEN || ownerId === userId;

const view = (payment: {
  id: string;
  status: PaymentStatus;
  amount: Prisma.Decimal;
  currency: string;
  paymentGateway: string;
  merchantInvoiceNumber: string;
  checkoutUrl: string | null;
  initiatedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PaymentStatusView => ({
  ...payment,
  amount: payment.amount.toString(),
});

const getRequestPayment = async (paymentId: string, user: RequestUser) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      serviceRequest: { select: { citizen: { select: { userId: true } } } },
    },
  });
  if (!payment?.serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Request payment not found.");
  }
  if (
    !canViewRequestPayment(
      user.role,
      payment.serviceRequest.citizen.userId,
      user.userId,
    )
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to view this payment.",
    );
  }
  return view(payment);
};

const initiate = async (requestId: string, user: RequestUser) => {
  if (user.role !== Role.CITIZEN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only citizens can initiate request payments.",
    );
  }

  let draft: Awaited<ReturnType<typeof createDraft>>;
  try {
    draft = await createDraft(requestId, user.userId);
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existing = await prisma.payment.findFirst({
      where: {
        serviceRequestId: requestId,
        status: { in: [PaymentStatus.UNPAID, PaymentStatus.PENDING] },
      },
    });
    if (!existing) throw error;
    return view(existing);
  }
  if (draft.existing) return view(draft.payment);

  try {
    const provider = await createBkashPayment({
      amount: draft.payment.amount.toString(),
      currency: draft.payment.currency,
      intent: "sale",
      merchantInvoiceNumber: draft.payment.merchantInvoiceNumber,
      callbackURL: config.bkash_callback_url || config.bkash_success_url,
    });
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUniqueOrThrow({
        where: { id: draft.payment.id },
      });
      if (
        current.bkashPaymentId &&
        current.bkashPaymentId !== provider.paymentID
      ) {
        throw new AppError(
          httpStatus.CONFLICT,
          "Payment provider identifier mismatch.",
        );
      }
      return tx.payment.update({
        where: { id: current.id },
        data: {
          status: PaymentStatus.PENDING,
          bkashPaymentId: current.bkashPaymentId || provider.paymentID,
          checkoutUrl: provider.bkashURL,
          initiatedAt: current.initiatedAt || new Date(),
        },
      });
    });
    return view(updated);
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: draft.payment.id, status: PaymentStatus.UNPAID },
      data: { status: PaymentStatus.FAILED, failedAt: new Date() },
    });
    throw error;
  }
};

const createDraft = async (requestId: string, userId: string) =>
  prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        caseType: true,
        citizen: { select: { userId: true } },
        category: {
          select: { feeAmount: true, feeCurrency: true, isActive: true },
        },
      },
    });
    if (!request || request.citizen.userId !== userId) {
      throw new AppError(httpStatus.NOT_FOUND, "Service request not found.");
    }
    if (request.caseType === "COMPLAINT") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Complaints do not require payment.",
      );
    }
    if (!request.category?.isActive) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This service request category is free or unavailable.",
      );
    }
    const feeMinorUnits = moneyInMinorUnits(
      request.category.feeAmount.toString(),
    );
    if (feeMinorUnits <= 0n || request.category.feeCurrency !== "BDT") {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "This service request category is free or unavailable.",
      );
    }
    const existing = await tx.payment.findFirst({
      where: {
        serviceRequestId: requestId,
        status: { in: [PaymentStatus.UNPAID, PaymentStatus.PENDING] },
      },
    });
    if (existing) return { existing: true as const, payment: existing };
    const payment = await tx.payment.create({
      data: {
        serviceRequestId: request.id,
        amount: request.category.feeAmount,
        currency: request.category.feeCurrency,
        status: PaymentStatus.UNPAID,
        merchantInvoiceNumber: `CIVIC-${request.id.slice(0, 12)}-${Date.now()}`,
      },
    });
    return { existing: false as const, payment };
  });

const reconcile = async (
  paymentId: string,
  provider: ProviderPayment,
  callbackResult: CallbackResult,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        serviceRequest: { select: { citizen: { select: { userId: true } } } },
      },
    });
    if (!payment?.serviceRequest)
      throw new AppError(httpStatus.NOT_FOUND, "Request payment not found.");
    if (payment.bkashPaymentId !== provider.paymentID) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Payment provider identifier mismatch.",
      );
    }
    if (
      payment.bkashTrxId &&
      provider.trxID &&
      payment.bkashTrxId !== provider.trxID
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Payment transaction identifier mismatch.",
      );
    }
    if (payment.status === PaymentStatus.COMPLETED)
      return {
        payment,
        recipientId: payment.serviceRequest.citizen.userId,
        changed: false,
      };
    if (
      mapProviderStatus(provider.transactionStatus) === PaymentStatus.COMPLETED
    ) {
      if (
        !provider.amount ||
        !provider.currency ||
        !provider.trxID ||
        !amountsMatch(payment.amount.toString(), provider.amount) ||
        provider.currency !== payment.currency
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Provider payment amount or currency does not match.",
        );
      }
    }
    const status = nextPaymentStatus(
      payment.status,
      provider.transactionStatus,
    );
    if (
      payment.status === status &&
      (status === PaymentStatus.FAILED || status === PaymentStatus.CANCELLED)
    ) {
      return {
        payment,
        recipientId: payment.serviceRequest.citizen.userId,
        changed: false,
      };
    }
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status,
        bkashTrxId: provider.trxID || payment.bkashTrxId,
        completedAt: status === PaymentStatus.COMPLETED ? new Date() : null,
        failedAt: status === PaymentStatus.FAILED ? new Date() : null,
        cancelledAt: status === PaymentStatus.CANCELLED ? new Date() : null,
      },
    });
    return {
      payment: updated,
      recipientId: payment.serviceRequest.citizen.userId,
      changed: true,
    };
  });
  const outcomeStatus =
    result.payment.status === PaymentStatus.COMPLETED
      ? PaymentStatus.COMPLETED
      : result.payment.status === PaymentStatus.FAILED
        ? PaymentStatus.FAILED
        : null;
  if (result.changed && outcomeStatus) {
    publishPaymentOutcome(result.recipientId, result.payment.id, outcomeStatus);
  }

  // Generate invoice PDF after payment is completed (fire-and-forget)
  if (result.payment.status === PaymentStatus.COMPLETED) {
    void invoiceServices
      .generateAndPersistInvoice(result.payment.id)
      .then(() => invoiceServices.emailInvoice(result.payment.id))
      .catch((error) => {
        console.error("Invoice generation/email failed:", error);
      });
  }

  return view(result.payment);
};

const handleCallback = async (
  paymentId: string,
  callbackResult: CallbackResult,
) => {
  const payment = await prisma.payment.findFirst({
    where: { bkashPaymentId: paymentId, serviceRequestId: { not: null } },
    select: { id: true, status: true },
  });
  if (!payment)
    throw new AppError(httpStatus.NOT_FOUND, "Request payment not found.");
  if (payment.status === PaymentStatus.COMPLETED) {
    const completed = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    return view(completed);
  }
  if (callbackResult === "success") await executeBkashPayment(paymentId);
  const provider = await queryBkashPayment(paymentId);
  return reconcile(payment.id, provider, callbackResult);
};

export const requestPaymentServices = {
  initiate,
  getRequestPayment,
  handleCallback,
  moneyInMinorUnits,
  amountsMatch,
  mapProviderStatus,
  nextPaymentStatus,
  canViewRequestPayment,
};
