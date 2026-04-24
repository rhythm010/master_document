import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/requireRole";
import { companionProfileController } from "./companion-profile.controller";
import { uploadProfilePicture } from "./companion-profile.upload";

const router = Router();

router.get(
  "/companion-profiles/me",
  authMiddleware,
  requireRole("COMPANION"),
  companionProfileController.getMe
);

router.post(
  "/companion-profiles/upload-picture",
  authMiddleware,
  requireRole("COMPANION"),
  uploadProfilePicture.single("picture"),
  companionProfileController.uploadPicture
);

router.patch(
  "/companion-profiles/me",
  authMiddleware,
  requireRole("COMPANION"),
  companionProfileController.updateProfile
);

router.patch(
  "/companion-profiles/toggle-active",
  authMiddleware,
  requireRole("COMPANION"),
  companionProfileController.toggleActive
);

export { router as companionProfileRouter };
