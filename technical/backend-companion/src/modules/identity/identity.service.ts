import crypto from "crypto";

import { prisma } from "../../shared/db/prisma";
import { config } from "../../shared/config";
import { logger } from "../../shared/logger";
import { hashPassword, verifyPassword } from "../../shared/utils/password";
import {
  signAuthToken,
  signEmailVerifyToken,
  verifyEmailVerifyToken
} from "../../shared/utils/jwt";
import { EmailRateLimiter } from "../../shared/utils/rateLimiter";
import { sendVerificationEmail } from "../../shared/services/emailService";
import type { UserRole, CompanionDesignation } from "../../shared/types/enums";

import { identityRepository } from "./identity.repository";
import { identityErrors } from "./identity.errors";
import type { PublicUserDTO, CompanionProfileDTO } from "./identity.types";
import { rosterService } from "../roster";

// In-memory limiter for email-based login attempts.
const emailRateLimiter = new EmailRateLimiter(
  config.loginRateLimitMaxAttempts,
  config.loginRateLimitWindowMinutes * 60 * 1000
);

export const identityService = {
  // Create a user, optionally a companion profile, and send a verification email.
  async signup(input: {
    role: UserRole;
    name: string;
    nickname: string;
    email: string;
    password: string;
    biometricAuthEnabled?: boolean;
  }): Promise<PublicUserDTO> {
    // Normalize to avoid case-sensitive duplicates.
    const email = normalizeEmail(input.email);
    const existing = await identityRepository.findUserByEmail(prisma, email);
    if (existing) {
      throw identityErrors.emailAlreadyExists();
    }

    // Hash the password before persisting.
    const passwordHash = await hashPassword(input.password, config.bcryptRounds);

    // Wrap user + profile creation in a transaction for consistency.
    const user = await prisma.$transaction(async (tx) => {
      let designation: CompanionDesignation | null = null;
      if (input.role === "COMPANION") {
        // Balance companion designation between CAPTAIN and VICE_CAPTAIN.
        const [captainCount, viceCount] = await Promise.all([
          identityRepository.countCompanionsByDesignation(tx, "CAPTAIN"),
          identityRepository.countCompanionsByDesignation(tx, "VICE_CAPTAIN")
        ]);
        designation = captainCount <= viceCount ? "CAPTAIN" : "VICE_CAPTAIN";
      }

      // Create the base user record.
      const createdUser = await identityRepository.createUser(tx, {
        id: crypto.randomUUID(),
        role: input.role,
        name: input.name,
        nickname: input.nickname,
        email,
        passwordHash,
        emailVerified: false,
        biometricAuthEnabled: input.biometricAuthEnabled ?? false
      });

      if (designation) {
        // Provision companion profile and seed roster slots.
        await identityRepository.createCompanionProfile(tx, {
          id: crypto.randomUUID(),
          userId: createdUser.id,
          designation
        });

        await rosterService.populateForCompanion(tx, createdUser.id);
      }

      return createdUser;
    });

    // Send a verification email; do not fail signup if delivery fails.
    const token = signEmailVerifyToken({ sub: user.id, email: user.email });
    try {
      await sendVerificationEmail({ to: user.email, name: user.name, token });
    } catch (error) {
      logger.error({ error, email: user.email }, "verification email failed");
    }

    return toPublicUser(user);
  },

  // Validate the email token and mark the user as verified.
  async verifyEmail(token: string) {
    const payload = verifyEmailVerifyToken(token);
    const user = await identityRepository.findUserById(prisma, payload.sub);
    if (!user) {
      throw identityErrors.userNotFound();
    }

    if (!user.emailVerified) {
      await identityRepository.updateEmailVerified(prisma, user.id);
    }

    return { status: "VERIFIED" };
  },

  // Re-send verification email for an unverified user.
  async resendVerification(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await identityRepository.findUserByEmail(prisma, email);
    if (!user) {
      throw identityErrors.userNotFound();
    }

    if (user.emailVerified) {
      throw identityErrors.emailAlreadyVerified();
    }

    const token = signEmailVerifyToken({ sub: user.id, email: user.email });
    await sendVerificationEmail({ to: user.email, name: user.name, token });
    return { message: "Verification email sent" };
  },

  // Authenticate credentials, enforce verification, and issue an access token.
  async login(input: { email: string; password: string }) {
    const email = normalizeEmail(input.email);
    if (emailRateLimiter.isLimited(email)) {
      throw identityErrors.tooManyAttempts();
    }

    const user = await identityRepository.findUserByEmail(prisma, email);
    if (!user) {
      // Count failures for unknown users to slow enumeration attempts.
      emailRateLimiter.recordFailure(email);
      throw identityErrors.invalidCredentials();
    }

    const passwordMatch = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatch) {
      // Count failures for incorrect passwords.
      emailRateLimiter.recordFailure(email);
      throw identityErrors.invalidCredentials();
    }

    if (!user.emailVerified) {
      throw identityErrors.emailNotVerified();
    }

    // Clear the failure window after a successful login.
    emailRateLimiter.reset(email);

    // Build the access token response.
    const accessToken = signAuthToken({ sub: user.id, role: user.role, email: user.email });
    return {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: config.authAccessTokenTtlSeconds,
      user: toPublicUser(user)
    };
  },

  // Return the authenticated user with optional companion profile data.
  async getMe(userId: string) {
    const user = await identityRepository.findUserById(prisma, userId);
    if (!user) {
      throw identityErrors.userNotFound();
    }

    let companionProfile: CompanionProfileDTO | undefined;
    if (user.role === "COMPANION") {
      // Fetch companion profile when applicable.
      const profile = await identityRepository.findCompanionProfileByUserId(prisma, user.id);
      if (profile) {
        companionProfile = toCompanionProfile(profile);
      }
    }

    return toPublicUser(user, companionProfile);
  },

  // Update a user's nickname and return the refreshed profile.
  async updateNickname(userId: string, nickname: string) {
    const existing = await identityRepository.findUserById(prisma, userId);
    if (!existing) {
      throw identityErrors.userNotFound();
    }

    const updated = await identityRepository.updateNickname(prisma, userId, nickname);
    let companionProfile: CompanionProfileDTO | undefined;
    if (updated.role === "COMPANION") {
      // Attach companion profile when the role requires it.
      const profile = await identityRepository.findCompanionProfileByUserId(prisma, userId);
      if (profile) {
        companionProfile = toCompanionProfile(profile);
      }
    }

    return toPublicUser(updated, companionProfile);
  }
};

// Normalize email for consistent lookups and storage.
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Map a user record into the public API DTO.
function toPublicUser(user: {
  id: string;
  role: UserRole;
  name: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
  biometricAuthEnabled: boolean;
  createdAt: Date;
}, companionProfile?: CompanionProfileDTO): PublicUserDTO {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    nickname: user.nickname,
    email: user.email,
    emailVerified: user.emailVerified,
    biometricAuthEnabled: user.biometricAuthEnabled,
    createdAt: user.createdAt,
    companionProfile
  };
}

// Map a companion profile record into the API DTO.
function toCompanionProfile(profile: {
  id: string;
  userId: string;
  designation: CompanionDesignation;
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
