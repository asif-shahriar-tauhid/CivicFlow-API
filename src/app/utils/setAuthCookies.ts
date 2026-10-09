import type { Response } from "express";

const isProduction =
	process.env.NODE_ENV === "production" ||
	process.env.VERCEL === "1" ||
	Boolean(process.env.VERCEL_ENV) ||
	Boolean(process.env.BACKEND_URL?.startsWith("https"));

export const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	const secure = isProduction;
	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure,
		sameSite: secure ? "none" : "lax",
		maxAge: 86400000,
	});
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure,
		sameSite: secure ? "none" : "lax",
		maxAge: 604800000,
	});
};

export const clearAuthCookies = (res: Response) => {
	const secure = isProduction;
	res.clearCookie("accessToken", {
		httpOnly: true,
		secure,
		sameSite: secure ? "none" : "lax",
	});
	res.clearCookie("refreshToken", {
		httpOnly: true,
		secure,
		sameSite: secure ? "none" : "lax",
	});
};
