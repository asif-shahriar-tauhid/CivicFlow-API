import type { PaymentStatus } from "../../../generated/prisma/enums";

export type CallbackResult = "success" | "cancel" | "failure";

export type RequestPaymentStatus = PaymentStatus;

export interface PaymentStatusView {
  id: string;
  status: PaymentStatus;
  amount: string;
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
}
