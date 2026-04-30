import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { companionProfileService } from "../companion-profile.service";
import { ErrorCodes } from "../../../shared/errors/errorCodes";

const requireMock = (moduleName: string) => jest.requireMock(moduleName) as any;

jest.mock("../../../shared/db/prisma", () => ({
  prisma: {}
}));

jest.mock("../companion-profile.repository", () => ({
  companionProfileRepository: {
    findByUserId: jest.fn(),
    updateProfile: jest.fn(),
    updateActive: jest.fn()
  }
}));

describe("companionProfileService", () => {
  const profileRecord = {
    id: "profile-1",
    userId: "user-1",
    designation: "CAPTAIN" as const,
    isActive: true,
    languages: ["ENGLISH"],
    profilePictureUrl: "",
    averageRating: "4.25"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getMe returns the companion profile", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");
    companionProfileRepository.findByUserId.mockResolvedValue(profileRecord);

    const result = await companionProfileService.getMe("user-1");

    expect(result).toEqual(
      expect.objectContaining({
        id: "profile-1",
        designation: "CAPTAIN",
        averageRating: 4.25
      })
    );
  });

  test("getMe rejects missing profiles", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");
    companionProfileRepository.findByUserId.mockResolvedValue(null);

    await expect(companionProfileService.getMe("user-1")).rejects.toMatchObject({
      code: ErrorCodes.COMPANION_PROFILE_NOT_FOUND
    });
  });

  test("updateProfile deduplicates valid languages", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");

    companionProfileRepository.findByUserId.mockResolvedValue(profileRecord);
    companionProfileRepository.updateProfile.mockResolvedValue({
      ...profileRecord,
      languages: ["ENGLISH", "ARABIC"]
    });

    const result = await companionProfileService.updateProfile("user-1", {
      languages: ["ENGLISH", "ENGLISH", "ARABIC"],
      profilePictureUrl: "https://example.com/pic.jpg"
    });

    expect(companionProfileRepository.updateProfile).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      expect.objectContaining({
        languages: ["ENGLISH", "ARABIC"],
        profilePictureUrl: "https://example.com/pic.jpg"
      })
    );
    expect(result.languages).toEqual(["ENGLISH", "ARABIC"]);
  });

  test("updateProfile rejects invalid languages", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");

    companionProfileRepository.findByUserId.mockResolvedValue(profileRecord);

    await expect(
      companionProfileService.updateProfile("user-1", {
        languages: ["ENGLISH", "SPANISH"]
      })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_LANGUAGE });
  });

  test("updateProfile trims profilePictureUrl", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");

    companionProfileRepository.findByUserId.mockResolvedValue(profileRecord);
    companionProfileRepository.updateProfile.mockResolvedValue({
      ...profileRecord,
      profilePictureUrl: "https://example.com/pic.jpg"
    });

    await companionProfileService.updateProfile("user-1", {
      profilePictureUrl: "  https://example.com/pic.jpg  "
    });

    expect(companionProfileRepository.updateProfile).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      expect.objectContaining({
        profilePictureUrl: "https://example.com/pic.jpg"
      })
    );
  });

  test("updateProfile allows empty string for profilePictureUrl", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");

    companionProfileRepository.findByUserId.mockResolvedValue(profileRecord);
    companionProfileRepository.updateProfile.mockResolvedValue({
      ...profileRecord,
      profilePictureUrl: ""
    });

    await companionProfileService.updateProfile("user-1", {
      profilePictureUrl: "   "
    });

    expect(companionProfileRepository.updateProfile).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      expect.objectContaining({
        profilePictureUrl: ""
      })
    );
  });

  test("toggleActive updates the profile", async () => {
    const { companionProfileRepository } = requireMock("../companion-profile.repository");

    companionProfileRepository.findByUserId.mockResolvedValue(profileRecord);
    companionProfileRepository.updateActive.mockResolvedValue({
      ...profileRecord,
      isActive: false
    });

    const result = await companionProfileService.toggleActive("user-1", false);

    expect(companionProfileRepository.updateActive).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      false
    );
    expect(result.isActive).toBe(false);
  });
});
