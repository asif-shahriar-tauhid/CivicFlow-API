import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

const setAuthCookies = (
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

const registerUser = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.registerUser(req.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Registration started.",
		data: result,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.verifyEmail(req.body);
	setAuthCookies(res, result.accessToken, result.refreshToken);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Email verified successfully.",
		data: result,
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.loginUser(req.body);
	setAuthCookies(res, result.accessToken, result.refreshToken);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully.",
		data: result,
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.getMe(req.user as IRequestUser);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully.",
		data: result,
	});
});

export const AuthController = { registerUser, verifyEmail, loginUser, getMe };
