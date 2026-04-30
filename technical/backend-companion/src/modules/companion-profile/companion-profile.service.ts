import { companionProfileRepository } from "./companion-profile.repository";
import { companionProfileErrors } from "./companion-profile.errors";
import type { CompanionProfileDTO } from "./companion-profile.types";
import { prisma } from "../../shared/db/prisma";
import { buildPublicUrl } from "../../shared/utils/urls";

const ALLOWED_LANGUAGES = ["ENGLISH", "ARABIC"] as const;

export const companionProfileService = {
  // Fetch the current user's companion profile or raise a not-found error.
  async getMe(userId: string): Promise<CompanionProfileDTO> {
    const profile = await companionProfileRepository.findByUserId(prisma, userId);
    if (!profile) {
      throw companionProfileErrors.profileNotFound();
    }

    return toCompanionProfile(profile);
  },

  // Validate and update the companion profile fields.
  async updateProfile(userId: string, input: { languages?: string[]; profilePictureUrl?: string }) {
    const profile = await companionProfileRepository.findByUserId(prisma, userId);
    if (!profile) {
      throw companionProfileErrors.profileNotFound();
    }

    let languages = input.languages;
    if (languages) {
      // Enforce allowed values and de-duplicate user input.
      const invalid = languages.find((value) => !ALLOWED_LANGUAGES.includes(value as any));
      if (invalid) {
        throw companionProfileErrors.invalidLanguage();
      }
      languages = Array.from(new Set(languages));
    }

    let profilePictureUrl = input.profilePictureUrl;
    if (profilePictureUrl !== undefined) {
      // Trim whitespace from profile picture URL. Empty string is allowed (removes picture).
      profilePictureUrl = profilePictureUrl.trim();
    }

    const updated = await companionProfileRepository.updateProfile(prisma, userId, {
      languages,
      profilePictureUrl
    });

    return toCompanionProfile(updated);
  },

  // Enable or disable a companion profile for booking availability.
  async toggleActive(userId: string, isActive: boolean) {
    const profile = await companionProfileRepository.findByUserId(prisma, userId);
    if (!profile) {
      throw companionProfileErrors.profileNotFound();
    }

    const updated = await companionProfileRepository.updateActive(prisma, userId, isActive);
    return toCompanionProfile(updated);
  },

  // Convert a relative upload path into a public URL.
  buildProfilePictureUrl(filePath: string) {
    return buildPublicUrl(filePath);
  }
};

// Convert a database record into the API-facing DTO.
function toCompanionProfile(profile: {
  id: string;
  userId: string;
  designation: "CAPTAIN" | "VICE_CAPTAIN";
  isActive: boolean;
  languages: string[];
  profilePictureUrl: string;
  averageRating: unknown;
}): CompanionProfileDTO {
  return {
    id: profile.id,
    userId: profile.userId,
    designation: profile.designation,
    isActive: profile.isActive,
    languages: profile.languages,
    profilePictureUrl: profile.profilePictureUrl,
    averageRating: Number(profile.averageRating)
  };
}
