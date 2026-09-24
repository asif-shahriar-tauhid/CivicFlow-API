import z from "zod";

const PatientRegistrationZodSchema = z.object({
  name: z
    .string("Name must be a string.")
    .min(3, "Name must be of at least 3 characters")
    .max(50, "Name at most can have 50 characters"),
  email: z.email(
    "The Provided email is not an Email. Example-'someone@something.com'",
  ),
  password: z
    .string()
    .min(8, "Password must be 8 characters long.")
    .regex(/[A-Z]/, "Password must contain at least one Uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one Lowercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include one special character"),
  patient: z
    .object({
      contactNumber: z.string().optional(),
    })
    .optional(),
});
const PatientEmailVerificationZodSchema = z.object({
  email: z.email(
    "The Provided email is not an Email. Example-'someone@something.com'",
  ),
  otp: z.string().length(6),
});

const LoginZodSchema = z.object({
  email: z.email(
    "The Provided email is not an Email. Example-'someone@something.com'",
  ),
  password: z
    .string()
    .min(8, "Password must be 8 characters long.")
    .regex(/[A-Z]/, "Password must contain at least one Uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one Lowercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include one special character"),
});

const resetPasswordZodSchema = z.object({
  email: z.email(
    "The Provided email is not an Email. Example-'someone@something.com'",
  ),
  newPassword: z
    .string()
    .min(8, "Password must be 8 characters long.")
    .regex(/[A-Z]/, "Password must contain at least one Uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one Lowercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include one special character"),
  otp: z.string().length(6),
});
const forgotPasswordZodSchema = z.object({
  email: z.email(
    "The Provided email is not an Email. Example-'someone@something.com'",
  ),
});

export const userValidation = {
  PatientRegistrationZodSchema,
  PatientEmailVerificationZodSchema,
  LoginZodSchema,
  resetPasswordZodSchema,
  forgotPasswordZodSchema,
};
