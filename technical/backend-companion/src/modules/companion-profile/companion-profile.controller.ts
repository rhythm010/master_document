import path from "path";
import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";
import { companionProfileService } from "./companion-profile.service";
import { companionProfileErrors } from "./companion-profile.errors";
import { updateProfileSchema, toggleActiveSchema } from "./companion-profile.schema";

export const companionProfileController = {
  // Return the authenticated companion's profile.
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const result = await companionProfileService.getMe(req.user!.id);
    res.status(200).json(result);
  }),
  // Validate upload, build a public URL, and return it to the client.
  uploadPicture: asyncHandler(async (req: Request, res: Response) => {
    // Multer should populate req.file; reject if the upload was missing.
    if (!req.file) {
      throw companionProfileErrors.validationError("Missing file");
    }

    // Normalize to a forward-slash relative path so URLs are consistent across OSes.
    const relativePath = path
      .relative(process.cwd(), req.file.path)
      .split(path.sep)
      .join("/");
    const profilePictureUrl = companionProfileService.buildProfilePictureUrl(relativePath);
    res.status(200).json({ profilePictureUrl });
  }),
  // Update companion profile fields after validating the input.
  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const input = updateProfileSchema.parse(req.body);
    const result = await companionProfileService.updateProfile(req.user!.id, input);
    res.status(200).json(result);
  }),
  // Toggle the companion's active status.
  toggleActive: asyncHandler(async (req: Request, res: Response) => {
    const input = toggleActiveSchema.parse(req.body);
    const result = await companionProfileService.toggleActive(req.user!.id, input.isActive);
    res.status(200).json(result);
  })
};
