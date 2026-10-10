import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { actorFromReq, emitAuditLog } from "../auditLog/auditLog.service";
import type { CallbackResult } from "./requestPayment.interface";
import { requestPaymentServices } from "./requestPayment.service";

const currentUser = (req: Request) => {
	if (!req.user)
		throw new AppError(httpStatus.UNAUTHORIZED, "Authentication is required.");
	return req.user;
};

const callbackResult = (value: string): CallbackResult => {
	if (value !== "success" && value !== "cancel" && value !== "failure") {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment callback.");
	}
	return value;
};

const isAllowedOrigin = (urlStr: string): boolean => {
	try {
		const parsed = new URL(urlStr);
		const origin = parsed.origin;
		const allowedOrigins = [
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://civic-flow-frontend-psi.vercel.app",
			...(config.frontend_url
				? config.frontend_url.split(",").map((s) => s.trim())
				: []),
			...(process.env.FRONTEND_URL
				? process.env.FRONTEND_URL.split(",").map((s) => s.trim())
				: []),
		];
		return (
			allowedOrigins.includes(origin) ||
			origin.endsWith(".vercel.app") ||
			origin.includes("civic-flow-frontend")
		);
	} catch {
		return false;
	}
};

const resolveRedirectFrontendUrl = (savedGatewayResponse?: unknown): string => {
	if (
		savedGatewayResponse &&
		typeof savedGatewayResponse === "object" &&
		savedGatewayResponse !== null
	) {
		const saved = (savedGatewayResponse as Record<string, unknown>).frontendUrl;
		if (typeof saved === "string" && isAllowedOrigin(saved)) {
			try {
				return new URL(saved).origin;
			} catch {
				// ignore invalid URL
			}
		}
	}
	return config.frontend_url;
};

const initiate = catchAsync(async (req: Request, res: Response) => {
	const originHeader = (req.headers.origin || req.headers.referer) as
		| string
		| undefined;
	let clientOrigin: string | undefined;
	if (originHeader) {
		try {
			const candidate = new URL(originHeader).origin;
			if (isAllowedOrigin(candidate)) {
				clientOrigin = candidate;
			}
		} catch {
			// ignore invalid URL
		}
	}
	const candidateBody =
		(req.body?.frontendUrl as string) || (req.query?.frontendUrl as string);
	if (candidateBody && isAllowedOrigin(candidateBody)) {
		try {
			clientOrigin = new URL(candidateBody).origin;
		} catch {
			// ignore invalid URL
		}
	}

	const data = await requestPaymentServices.initiate(
		req.params.requestId as string,
		currentUser(req),
		clientOrigin,
	);
	emitAuditLog({
		...actorFromReq(req),
		action: "PAYMENT_INITIATED",
		entity: "Payment",
		entityId: data.id,
		after: {
			status: data.status,
			amount: data.amount,
			currency: data.currency,
			merchantInvoiceNumber: data.merchantInvoiceNumber,
			serviceRequestId: req.params.requestId,
		},
	});
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Request payment initiated successfully.",
		data,
	});
});

const status = catchAsync(async (req: Request, res: Response) => {
	const targetId = (req.params.requestId || req.params.paymentId) as string;
	const data = await requestPaymentServices.getRequestPayment(
		targetId,
		currentUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Request payment status retrieved successfully.",
		data,
	});
});

const callback = catchAsync(async (req: Request, res: Response) => {
	const paymentId = String(req.body?.paymentID || req.query.paymentID || "");
	const queryStatus = String(req.query.status || "").toLowerCase();

	// Prioritize gateway query parameter (?status=success|cancel|failure)
	let result: CallbackResult = "success";
	if (["cancel", "canceled"].includes(queryStatus)) {
		result = "cancel";
	} else if (["failure", "failed"].includes(queryStatus)) {
		result = "failure";
	} else if (queryStatus === "success") {
		result = "success";
	} else {
		result = callbackResult(req.params.result as string);
	}

	try {
		if (!paymentId) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Payment identifier is required.",
			);
		}

		const data = await requestPaymentServices.handleCallback(paymentId, result);

		emitAuditLog({
			actorId: req.user?.userId ?? null,
			actorEmail: req.user?.email ?? null,
			req,
			action: "PAYMENT_RECONCILED",
			entity: "Payment",
			entityId: data.id,
			after: {
				status: data.status,
				amount: data.amount,
				currency: data.currency,
				merchantInvoiceNumber: data.merchantInvoiceNumber,
			},
		});

		if (req.method === "GET") {
			const payment = await prisma.payment.findUnique({
				where: { id: data.id },
				select: { gatewayResponse: true },
			});
			const baseFrontendUrl = resolveRedirectFrontendUrl(
				payment?.gatewayResponse,
			);
			const redirectUrl = new URL(`${baseFrontendUrl}/citizen/payments/result`);
			redirectUrl.searchParams.set("paymentId", data.id);
			redirectUrl.searchParams.set("status", data.status);
			if (data.serviceRequestId) {
				redirectUrl.searchParams.set("requestId", data.serviceRequestId);
			}
			return res.redirect(redirectUrl.toString());
		}

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payment callback reconciled successfully.",
			data,
		});
	} catch (error) {
		console.error("Callback reconciliation error:", error);
		if (req.method === "GET") {
			// Always redirect to frontend UI result page on browser callback, even on gateway errors
			let baseFrontendUrl = resolveRedirectFrontendUrl();
			let paymentRecord: {
				id: string;
				serviceRequestId: string | null;
				status: string;
			} | null = null;
			if (paymentId) {
				const payment = await prisma.payment.findFirst({
					where: { bkashPaymentId: paymentId },
					select: {
						id: true,
						serviceRequestId: true,
						status: true,
						gatewayResponse: true,
					},
				});
				if (payment) {
					baseFrontendUrl = resolveRedirectFrontendUrl(payment.gatewayResponse);
					paymentRecord = payment;
				}
			}
			const redirectUrl = new URL(`${baseFrontendUrl}/citizen/payments/result`);
			if (paymentRecord) {
				redirectUrl.searchParams.set("paymentId", paymentRecord.id);
				redirectUrl.searchParams.set("status", paymentRecord.status);
				if (paymentRecord.serviceRequestId) {
					redirectUrl.searchParams.set(
						"requestId",
						paymentRecord.serviceRequestId,
					);
				}
			}
			if (!redirectUrl.searchParams.has("status")) {
				redirectUrl.searchParams.set(
					"status",
					result === "cancel" ? "CANCELLED" : "FAILED",
				);
			}
			return res.redirect(redirectUrl.toString());
		}
		throw error;
	}
});

export const requestPaymentController = { initiate, status, callback };
