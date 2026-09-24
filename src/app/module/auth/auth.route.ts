import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();
router.post(
	"/register",
	validateRequest(AuthValidation.RegisterZodSchema),
	AuthController.registerUser,
);
router.post(
	"/verify-email",
	validateRequest(AuthValidation.VerifyEmailZodSchema),
	AuthController.verifyEmail,
);
router.post(
	"/login",
	validateRequest(AuthValidation.LoginZodSchema),
	AuthController.loginUser,
);
router.get("/me", auth(), AuthController.getMe);

export const AuthRoutes = router;
