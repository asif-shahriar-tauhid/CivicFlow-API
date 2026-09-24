import { z } from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters long.")
	.regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
	.regex(/[a-z]/, "Password must contain at least one lowercase letter.")
	.regex(/[0-9]/, "Password must include at least one number.")
	.regex(
		/[^A-Za-z0-9]/,
		"Password must include at least one special character.",
	);

const RegisterZodSchema = z.object({
	name: z.string().trim().min(2).max(60),
	email: z.email(),
	password: passwordSchema,
});

const VerifyEmailZodSchema = z.object({
	email: z.email(),
	otp: z.string().length(6),
});
const LoginZodSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export const AuthValidation = {
	RegisterZodSchema,
	VerifyEmailZodSchema,
	LoginZodSchema,
};
