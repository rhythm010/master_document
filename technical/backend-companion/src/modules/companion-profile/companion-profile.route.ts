import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/requireRole";
import { companionProfileController } from "./companion-profile.controller";
import { uploadProfilePicture } from "./companion-profile.upload";

const router = Router();

// Return the current companion profile.
router.get(
  "/companion-profiles/me",
  authMiddleware,
  requireRole("COMPANION"),
  companionProfileController.getMe
);

// Upload a profile picture for the current companion.
router.post(
  "/companion-profiles/upload-picture",
  authMiddleware,
  requireRole("COMPANION"),
  uploadProfilePicture.single("picture"),
  companionProfileController.uploadPicture
);

// Update profile attributes such as languages or picture URL.
router.patch(
  "/companion-profiles/me",
  authMiddleware,
  requireRole("COMPANION"),
  companionProfileController.updateProfile
);

// Toggle the companion's availability for bookings.
router.patch(
  "/companion-profiles/toggle-active",
  authMiddleware,
  requireRole("COMPANION"),
  companionProfileController.toggleActive
);

export { router as companionProfileRouter };
