import config from "../config";
import { AppError } from "../utils/AppError";
import { redisClient } from "./redis";
import httpStatus from "http-status";

export const getBkashIdToken = async () => {
  try {
    if (
      !config.bkash_base_url ||
      !config.bkash_username ||
      !config.bkash_password ||
      !config.bkash_app_key ||
      !config.bkash_app_secret
    ) {
      throw new AppError(
        httpStatus.SERVICE_UNAVAILABLE,
        "bKash is not configured.",
      );
    }
    const IdTokenKey = "bkash: idToken";
    const RefreshTokenKey = "bkash: refreshToken";

    let bkashIdToken = await redisClient.get(IdTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);

    const bkashRefreshToken = await redisClient.get(RefreshTokenKey);

    if ((bkashIdTokenTTL < 600 || !bkashIdToken) && bkashRefreshToken) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );

      if (!refreshTokenResponse.ok) {
        throw new AppError(
          httpStatus.BAD_GATEWAY,
          "Bkash Access Token Grant failed.",
        );
      }
      const bkashRefreshTokenResult = await refreshTokenResponse.json();

      bkashIdToken = bkashRefreshTokenResult.id_token as string;

      await redisClient.set(IdTokenKey, bkashIdToken, {
        expiration: {
          type: "EX",
          value: 60 * 69,
        },
      });
      return bkashIdToken;
    }

    if (bkashIdToken && bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Bkash Access Token Grant Failed",
      );
    }

    const result = await response.json();

    await redisClient.set(IdTokenKey, result.id_token, {
      expiration: {
        type: "EX",
        value: 60 * 60,
      },
    });

    await redisClient.set(RefreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24 * 28,
      },
    });

    bkashIdToken = result.id_token;

    return bkashIdToken;
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      error instanceof Error ? error.message : "bKash authentication failed.",
    );
  }
};

type BkashRequest = {
  amount: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
  callbackURL: string;
};

const bkashRequest = async <T>(
  path: string,
  method: "POST" | "GET",
  body?: unknown,
) => {
  const token = await getBkashIdToken();
  const appKey = config.bkash_app_key;
  if (!token || !appKey) {
    throw new AppError(httpStatus.BAD_GATEWAY, "bKash authentication failed.");
  }
  const response = await fetch(`${config.bkash_base_url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": appKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json()) as T & {
    statusCode?: string;
    statusMessage?: string;
  };
  if (!response.ok || (result.statusCode && result.statusCode !== "0000")) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      result.statusMessage || "bKash request failed.",
    );
  }
  return result;
};

export const createBkashPayment = (payload: BkashRequest) =>
  bkashRequest<{
    paymentID: string;
    bkashURL: string;
    transactionStatus: string;
  }>("/tokenized/checkout/create", "POST", {
    mode: "0011",
    payerReference: payload.merchantInvoiceNumber,
    callbackURL: payload.callbackURL,
    amount: payload.amount,
    currency: payload.currency,
    intent: payload.intent,
    merchantInvoiceNumber: payload.merchantInvoiceNumber,
  });

export const executeBkashPayment = (paymentId: string) =>
  bkashRequest<{
    paymentID: string;
    trxID?: string;
    transactionStatus: string;
    amount?: string;
    currency?: string;
  }>(
    `/tokenized/checkout/execute/${encodeURIComponent(paymentId)}`,
    "POST",
    {},
  );

export const queryBkashPayment = (paymentId: string) =>
  bkashRequest<{
    paymentID: string;
    trxID?: string;
    transactionStatus: string;
    amount?: string;
    currency?: string;
  }>(
    `/tokenized/checkout/payment/status/${encodeURIComponent(paymentId)}`,
    "GET",
  );
