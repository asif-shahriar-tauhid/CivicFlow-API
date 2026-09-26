import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (
  schema: ZodTypeAny,
  source: "body" | "query" = "body",
) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const result = await schema.safeParseAsync(req[source] ?? {});
      if (!result.success) {
        next(result.error);
        return;
      }
      if (source === "body") req.body = result.data;
      else Object.assign(req.query, result.data);
      next();
    },
  );
};
