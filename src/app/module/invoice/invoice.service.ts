import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { uploadToCloudinary, deleteFromCloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { Role } from "../../../generated/prisma/enums";
import type { RequestUser } from "../../interfaces";
import type { InvoiceData, InvoiceResult } from "./invoice.interface.ts";
import { generateInvoicePdf } from "./invoice.pdf";

const buildInvoiceData = async (paymentId: string): Promise<InvoiceData> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      serviceRequest: {
        select: {
          requestNumber: true,
          title: true,
          citizen: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  const citizen = payment.serviceRequest?.citizen;

  return {
    invoiceId: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
    paymentId: payment.id,
    providerTrxId: payment.bkashTrxId || undefined,
    merchantInvoiceNumber: payment.merchantInvoiceNumber,
    citizenName: citizen?.name || "N/A",
    citizenEmail: citizen?.email || "N/A",
    requestNumber: payment.serviceRequest?.requestNumber || undefined,
    requestTitle: payment.serviceRequest?.title || undefined,
    paidAt: payment.completedAt
      ? payment.completedAt.toISOString()
      : new Date().toISOString(),
    amount: payment.amount.toString(),
    currency: payment.currency,
    provider: payment.paymentGateway,
    status: payment.status,
  };
};

const generateAndPersistInvoice = async (
  paymentId: string,
): Promise<InvoiceResult> => {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { invoiceUrl: true, invoicePublicId: true, status: true },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  if (existing.invoiceUrl && existing.invoicePublicId) {
    return {
      invoiceUrl: existing.invoiceUrl,
      invoicePublicId: existing.invoicePublicId,
    };
  }

  if (existing.status !== "COMPLETED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invoice can only be generated for completed payments.",
    );
  }

  const invoiceData = await buildInvoiceData(paymentId);
  const pdfBuffer = await generateInvoicePdf(invoiceData);

  const uploadResult = await uploadToCloudinary(pdfBuffer, {
    folder: "civicflow/invoices",
    resource_type: "raw",
  });

  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        invoiceUrl: uploadResult.secure_url,
        invoicePublicId: uploadResult.public_id,
      },
    });
  } catch (error) {
    await deleteFromCloudinary(uploadResult.public_id, "raw");
    throw error;
  }

  return {
    invoiceUrl: uploadResult.secure_url,
    invoicePublicId: uploadResult.public_id,
  };
};

const emailInvoice = async (paymentId: string): Promise<void> => {
  try {
    if (!config.smtp_user || !config.smtp_password) return;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        invoiceUrl: true,
        merchantInvoiceNumber: true,
        serviceRequest: {
          select: { citizen: { select: { email: true, name: true } } },
        },
      },
    });

    if (!payment?.invoiceUrl || !payment.serviceRequest?.citizen?.email) return;

    const invoiceData = await buildInvoiceData(paymentId);
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    await transporter.sendMail({
      from: config.email_sender,
      to: payment.serviceRequest.citizen.email,
      subject: `CivicFlow Payment Invoice - ${payment.merchantInvoiceNumber}`,
      text: `Dear ${payment.serviceRequest.citizen.name},\n\nPlease find your payment invoice attached.\n\nThank you,\nCivicFlow`,
      attachments: [
        {
          filename: `invoice-${payment.merchantInvoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (error) {
    console.error("Invoice email delivery failed:", error);
  }
};

const getInvoice = async (paymentId: string, user: RequestUser) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      invoiceUrl: true,
      invoicePublicId: true,
      serviceRequest: {
        select: {
          citizen: { select: { userId: true } },
          departmentId: true,
        },
      },
      appointment: {
        select: {
          citizen: { select: { userId: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  if (!payment.invoiceUrl) {
    throw new AppError(httpStatus.NOT_FOUND, "Invoice has not been generated yet.");
  }

  if (user.role === Role.CITIZEN) {
    const ownerId =
      payment.serviceRequest?.citizen?.userId ||
      payment.appointment?.citizen?.userId;

    if (ownerId !== user.userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to access this invoice.",
      );
    }
  } else if (user.role === Role.STAFF) {
    const departmentId = payment.serviceRequest?.departmentId;
    if (departmentId && user.departmentId && departmentId !== user.departmentId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to access this invoice.",
      );
    }
  }

  return {
    paymentId: payment.id,
    invoiceUrl: payment.invoiceUrl,
    invoicePublicId: payment.invoicePublicId,
  };
};

export const invoiceServices = {
  generateAndPersistInvoice,
  emailInvoice,
  getInvoice,
  buildInvoiceData,
};
