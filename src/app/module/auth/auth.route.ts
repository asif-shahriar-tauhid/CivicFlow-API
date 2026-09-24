import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();
router.post(
  "/register",
  validateRequest(AuthValidation.registrationZodSchema),
  AuthController.registerUser,
);
router.post(
  "/verify-email",
  validateRequest(AuthValidation.emailVerificationZodSchema),
  AuthController.verifyEmail,
);
router.post(
  "/login",
  validateRequest(AuthValidation.LoginZodSchema),
  AuthController.loginUser,
);

router.get("/me", auth(), AuthController.getMe);

router.post("/google", AuthController.googleLogin);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPasswordZodSchema),
  AuthController.forgotPassword,
);
router.post(
  "/reset-password",
  validateRequest(AuthValidation.resetPasswordZodSchema),
  AuthController.resetPassword,
);

export const AuthRoutes = router;
