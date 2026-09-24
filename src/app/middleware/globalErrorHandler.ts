import type { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/AppError";

export const globalErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message =
    error instanceof Error ? error.message : "Internal Server Error";
  let errorSources: Array<{ path: string | number; message: string }> = [];

  if (error instanceof AppError) {
    statusCode = error.statusCode;
  } else if (error instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    errorSources = error.issues.map((issue) => ({
      path: String(issue.path.at(-1) ?? ""),
      message: issue.message,
    }));
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    statusCode = httpStatus.CONFLICT;
    message = "A record with this value already exists.";
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errorSources: errorSources.length ? errorSources : undefined,
    stack: config.node_env === "development" ? error.stack : undefined,
  });
};
