import { z } from "zod";

const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});

const createRoutingRuleSchema = z.object({
  categoryId: z.string().uuid(),
  departmentId: z.string().uuid(),
  location: z.string().trim().max(500).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

const assignStaffDepartmentSchema = z.object({
  departmentId: z.string().uuid().nullable(),
});

export const DepartmentValidation = {
  createDepartmentSchema,
  createRoutingRuleSchema,
  assignStaffDepartmentSchema,
};
