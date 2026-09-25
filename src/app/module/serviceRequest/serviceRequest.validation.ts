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

const createServiceRequestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  caseType: caseType.optional(),
  priority: requestPriority.optional(),
  location: z.string().trim().max(500).optional(),
  department: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  citizenId: z.string().uuid().optional(),
});

const updateServiceRequestSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  caseType: caseType.optional(),
  status: requestStatus.optional(),
  priority: requestPriority.optional(),
  location: z.string().trim().max(500).optional(),
  department: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  resolutionSummary: z.string().trim().max(5000).nullable().optional(),
});

export const ServiceRequestValidation = {
  createServiceRequestSchema,
  updateServiceRequestSchema,
};
