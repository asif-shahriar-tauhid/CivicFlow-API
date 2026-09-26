import { v2 as Cloudinary, type UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";

Cloudinary.config({
	cloud_name: config.cloudinary_cloud_name,
	api_key: config.cloudinary_api_key,
	api_secret: config.cloudinary_api_secret,
});

export const cloudinary = Cloudinary;

export interface ICloudinaryUploadOptions {
	folder?: string;
	resource_type?: "auto" | "image" | "raw" | "video";
}

export const uploadToCloudinary = (
	buffer: Buffer,
	options: ICloudinaryUploadOptions = {},
): Promise<UploadApiResponse> => {
	return new Promise<UploadApiResponse>((resolve, reject) => {
		cloudinary.uploader
			.upload_stream(
				{
					folder: options.folder || "civicflow/evidence",
					resource_type: options.resource_type || "auto",
				},
				(error, result) => {
					if (error) return reject(error);
					if (!result) {
						return reject(
							new AppError(
								httpStatus.INTERNAL_SERVER_ERROR,
								"No result returned from Cloudinary.",
							),
						);
					}
					resolve(result);
				},
			)
			.end(buffer);
	});
};

export const deleteFromCloudinary = async (
	publicId: string,
	resourceType: string = "image",
): Promise<void> => {
	if (!publicId) return;
	try {
		await cloudinary.uploader.destroy(publicId, {
			resource_type: resourceType,
		});
	} catch (error) {
		console.error(`Failed to delete Cloudinary asset (${publicId}):`, error);
	}
};
