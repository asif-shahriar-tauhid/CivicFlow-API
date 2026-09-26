import { z } from "zod";

const requestStatus = z.enum([
  "SUBMITTED",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "AWAITING_CITIZEN",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
  "ON_HOLD",
  "REOPENED",
]);

const createFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

const reportQuerySchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    status: requestStatus.optional(),
    categoryId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    searchTerm: z.string().trim().max(160).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "The report start date must be before the end date.",
    path: ["to"],
  });

export const RequestFeedbackValidation = {
  createFeedbackSchema,
  reportQuerySchema,
};
