import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../utils/AppError";

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"application/pdf",
] as const;

export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const normalizeUploadedFile = (
	req: Request,
): Express.Multer.File | undefined => {
	if (req.file) return req.file;
	if (Array.isArray(req.files) && req.files.length > 0) {
		return req.files[0];
	}
	if (req.files && typeof req.files === "object") {
		const filesDict = req.files as Record<string, Express.Multer.File[]>;
		for (const key of ["file", "attachment", "evidence"]) {
			if (filesDict[key]?.[0]) return filesDict[key][0];
		}
		const firstKey = Object.keys(filesDict)[0];
		if (firstKey && filesDict[firstKey]?.[0]) {
			return filesDict[firstKey][0];
		}
	}
	return undefined;
};

export const validateAttachmentFile = (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	const file = normalizeUploadedFile(req);
	if (!file) {
		throw new AppError(httpStatus.BAD_REQUEST, "Evidence file is required.");
	}

	req.file = file;

	if (
		!ALLOWED_ATTACHMENT_MIME_TYPES.includes(
			file.mimetype as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
		)
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Invalid file type "${file.mimetype}". Allowed types: JPEG, PNG, WEBP, GIF, and PDF.`,
		);
	}

	if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"File size exceeds the 10MB limit.",
		);
	}

	next();
};

export const validateOptionalAttachmentFiles = (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	const files: Express.Multer.File[] = [];
	if (req.file) {
		files.push(req.file);
	}
	if (Array.isArray(req.files)) {
		files.push(...req.files);
	} else if (req.files && typeof req.files === "object") {
		for (const group of Object.values(req.files)) {
			if (Array.isArray(group)) files.push(...group);
		}
	}

	for (const file of files) {
		if (
			!ALLOWED_ATTACHMENT_MIME_TYPES.includes(
				file.mimetype as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
			)
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Invalid file type "${file.mimetype}". Allowed types: JPEG, PNG, WEBP, GIF, and PDF.`,
			);
		}
		if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`File "${file.originalname}" exceeds the 10MB limit.`,
			);
		}
	}

	next();
};
