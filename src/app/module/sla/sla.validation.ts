import { z } from "zod";

const overdueQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const configSchema = z.object({
  slaMinutes: z.coerce.number().int().min(1).max(525600),
});

export const SlaValidation = {
  overdueQuerySchema,
  configSchema,
};
