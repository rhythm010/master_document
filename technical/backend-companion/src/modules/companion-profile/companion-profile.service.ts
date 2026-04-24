import { companionProfileRepository } from "./companion-profile.repository";
import { companionProfileErrors } from "./companion-profile.errors";
import type { CompanionProfileDTO } from "./companion-profile.types";
import { prisma } from "../../shared/db/prisma";
import { buildPublicUrl } from "../../shared/utils/urls";

const ALLOWED_LANGUAGES = ["ENGLISH", "ARABIC"] as const;

export const companionProfileService = {
  async getMe(userId: string): Promise<CompanionProfileDTO> {
    const profile = await companionProfileRepository.findByUserId(prisma, userId);
    if (!profile) {
      throw companionProfileErrors.profileNotFound();
    }

    return toCompanionProfile(profile);
  },

  async updateProfile(userId: string, input: { languages?: string[]; profilePictureUrl?: string }) {
    const profile = await companionProfileRepository.findByUserId(prisma, userId);
    if (!profile) {
      throw companionProfileErrors.profileNotFound();
    }

    let languages = input.languages;
    if (languages) {
      const invalid = languages.find((value) => !ALLOWED_LANGUAGES.includes(value as any));
      if (invalid) {
        throw companionProfileErrors.invalidLanguage();
      }
      languages = Array.from(new Set(languages));
    }

    const updated = await companionProfileRepository.updateProfile(prisma, userId, {
      languages,
      profilePictureUrl: input.profilePictureUrl
    });

    return toCompanionProfile(updated);
  },

  async toggleActive(userId: string, isActive: boolean) {
    const profile = await companionProfileRepository.findByUserId(prisma, userId);
    if (!profile) {
      throw companionProfileErrors.profileNotFound();
    }

    const updated = await companionProfileRepository.updateActive(prisma, userId, isActive);
    return toCompanionProfile(updated);
  },

  buildProfilePictureUrl(filePath: string) {
    return buildPublicUrl(filePath);
  }
};

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
