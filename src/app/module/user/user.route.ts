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

router.get("/", auth(Role.ADMIN), UserController.getAllUsers);
router.get(
  "/:userId",
  auth(Role.ADMIN, Role.STAFF, Role.CITIZEN),
  UserController.getUserById,
);
router.patch("/:userId", auth(Role.ADMIN), UserController.updateUser);
router.delete("/:userId", auth(Role.ADMIN), UserController.softDeleteUser);

export const UserRoutes = router;
