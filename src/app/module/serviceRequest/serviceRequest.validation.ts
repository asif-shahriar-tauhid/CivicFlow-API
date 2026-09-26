import { z } from "zod";

const caseType = z.enum(["COMPLAINT", "SERVICE_REQUEST"]);
const requestStatus = z.enum([
	"SUBMITTED",
	"IN_REVIEW",
	"IN_PROGRESS",
	"RESOLVED",
	"CLOSED",
	"REJECTED",
]);
const requestPriority = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const coordinateValidation = (data: {
	latitude?: number | null;
	longitude?: number | null;
}) => {
	const hasLat = data.latitude !== undefined && data.latitude !== null;
	const hasLng = data.longitude !== undefined && data.longitude !== null;
	return (hasLat && hasLng) || (!hasLat && !hasLng);
};

const createServiceRequestSchema = z
	.object({
		title: z.string().trim().min(3).max(160),
		description: z.string().trim().min(10).max(5000),
		caseType: caseType.optional(),
		priority: requestPriority.optional(),
		location: z.string().trim().max(500).optional(),
		address: z.string().trim().min(3).max(500).optional().nullable(),
		ward: z.string().trim().max(100).optional().nullable(),
		zone: z.string().trim().max(100).optional().nullable(),
		landmark: z.string().trim().max(255).optional().nullable(),
		latitude: z.coerce
			.number()
			.min(-90, "Latitude must be between -90 and 90 degrees.")
			.max(90, "Latitude must be between -90 and 90 degrees.")
			.optional()
			.nullable(),
		longitude: z.coerce
			.number()
			.min(-180, "Longitude must be between -180 and 180 degrees.")
			.max(180, "Longitude must be between -180 and 180 degrees.")
			.optional()
			.nullable(),
		categoryId: z.string().uuid().optional(),
		citizenId: z.string().uuid().optional(),
	})
	.refine(coordinateValidation, {
		message: "Both latitude and longitude must be provided together.",
		path: ["longitude"],
	});

const updateServiceRequestSchema = z
	.object({
		title: z.string().trim().min(3).max(160).optional(),
		description: z.string().trim().min(10).max(5000).optional(),
		caseType: caseType.optional(),
		status: requestStatus.optional(),
		priority: requestPriority.optional(),
		location: z.string().trim().max(500).optional(),
		address: z.string().trim().min(3).max(500).optional().nullable(),
		ward: z.string().trim().max(100).optional().nullable(),
		zone: z.string().trim().max(100).optional().nullable(),
		landmark: z.string().trim().max(255).optional().nullable(),
		latitude: z.coerce
			.number()
			.min(-90, "Latitude must be between -90 and 90 degrees.")
			.max(90, "Latitude must be between -90 and 90 degrees.")
			.optional()
			.nullable(),
		longitude: z.coerce
			.number()
			.min(-180, "Longitude must be between -180 and 180 degrees.")
			.max(180, "Longitude must be between -180 and 180 degrees.")
			.optional()
			.nullable(),
		categoryId: z.string().uuid().nullable().optional(),
		resolutionSummary: z.string().trim().max(5000).nullable().optional(),
	})
	.refine(
		(data) => {
			const hasLat = data.latitude !== undefined && data.latitude !== null;
			const hasLng = data.longitude !== undefined && data.longitude !== null;
			if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
				return false;
			}
			return true;
		},
		{
			message: "Both latitude and longitude must be provided together.",
			path: ["longitude"],
		},
	);

const createAttachmentSchema = z.object({
	caption: z.string().trim().max(255).optional(),
});

export const ServiceRequestValidation = {
	createServiceRequestSchema,
	updateServiceRequestSchema,
	createAttachmentSchema,
};
