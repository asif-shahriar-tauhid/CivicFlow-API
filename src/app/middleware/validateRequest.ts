import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (schema: ZodTypeAny) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			const result = await schema.safeParseAsync(req.body ?? {});
			if (!result.success) {
				next(result.error);
				return;
			}
			req.body = result.data;
			next();
		},
	);
};
