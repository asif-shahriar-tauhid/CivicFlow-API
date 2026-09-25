import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { UserController } from "./user.controller";

const router = Router();

router.patch(
  "/profile-image",
  auth(Role.CITIZEN, Role.ADMIN, Role.STAFF),
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

export const UserRoutes = router;
