import type { Response } from "express";

export const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	const secure = process.env.NODE_ENV === "production";
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
	const secure = process.env.NODE_ENV === "production";
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
