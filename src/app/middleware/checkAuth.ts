import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
	namespace Express {
		interface Request {
			user?: { userId: string; email: string; name: string; role: string };
		}
	}
}

export const auth = (...requiredRoles: string[]) =>
	catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
		const token =
			req.cookies?.accessToken ||
			req.headers.authorization?.replace("Bearer ", "");
		if (!token)
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Authentication is required.",
			);

		const verified = jwtUtils.verifyToken(token, config.jwt_access_secret);
		if (!verified.success)
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"Invalid or expired access token.",
			);

		const { userId, role } = verified.data as JwtPayload;
		if (requiredRoles.length > 0 && !requiredRoles.includes(String(role))) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You do not have permission to access this resource.",
			);
		}

		const user = await prisma.user.findUnique({
			where: { id: String(userId) },
		});
		if (!user || user.isDeleted || user.status === "DELETED") {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User account does not exist.",
			);
		}
		if (user.status === "BLOCKED")
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been blocked.",
			);

		req.user = {
			userId: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		};
		next();
	});
