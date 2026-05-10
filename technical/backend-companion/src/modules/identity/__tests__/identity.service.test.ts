import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { identityService } from "../identity.service";
import { ErrorCodes } from "../../../shared/errors/errorCodes";

const requireMock = (moduleName: string) => jest.requireMock(moduleName) as any;

jest.mock("../../../shared/config", () => ({
  config: {
    bcryptRounds: 10,
    authAccessTokenTtlSeconds: 3600,
    loginRateLimitMaxAttempts: 5,
    loginRateLimitWindowMinutes: 15,
    requireEmailVerification: true
  }
}));

jest.mock("../../../shared/db/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    venue: {
      findMany: jest.fn()
    }
  }
}));

jest.mock("../../../shared/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock("../../../shared/utils/password", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn()
}));

jest.mock("../../../shared/utils/jwt", () => ({
  signAuthToken: jest.fn(),
  signEmailVerifyToken: jest.fn(),
  verifyEmailVerifyToken: jest.fn()
}));

jest.mock("../../../shared/utils/rateLimiter", () => {
  const limiter = {
    isLimited: jest.fn(),
    recordFailure: jest.fn(),
    reset: jest.fn()
  };
  return {
    EmailRateLimiter: jest.fn(() => limiter),
    __limiter: limiter
  };
});

jest.mock("../../../shared/services/emailService", () => ({
  sendVerificationEmail: jest.fn()
}));

jest.mock("../../roster", () => ({
  rosterService: {
    populateForCompanion: jest.fn()
  }
}));

jest.mock("../identity.repository", () => ({
  identityRepository: {
    findUserByEmail: jest.fn(),
    countCompanionsByDesignation: jest.fn(),
    createUser: jest.fn(),
    createCompanionProfile: jest.fn(),
    findUserById: jest.fn(),
    updateEmailVerified: jest.fn(),
    updateNickname: jest.fn(),
    findCompanionProfileByUserId: jest.fn()
  }
}));

describe("identityService", () => {
  const baseUser = {
    id: "user-1",
    role: "CLIENT" as const,
    name: "Test User",
    nickname: "tester",
    email: "test@example.com",
    passwordHash: "hashed",
    emailVerified: false,
    biometricAuthEnabled: false,
    createdAt: new Date("2024-01-01T00:00:00Z")
  };

  const companionProfile = {
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
    const { prisma } = requireMock("../../../shared/db/prisma");
    prisma.$transaction.mockImplementation(async (callback: jest.Mock) => {
      const tx = {};
      return callback(tx);
    });
    prisma.venue.findMany.mockResolvedValue([]);

    const { __limiter } = requireMock("../../../shared/utils/rateLimiter");
    __limiter.isLimited.mockReturnValue(false);

    const { hashPassword } = requireMock("../../../shared/utils/password");
    hashPassword.mockResolvedValue("hashed");

    const { signEmailVerifyToken, signAuthToken } = requireMock("../../../shared/utils/jwt");
    signEmailVerifyToken.mockReturnValue("verify-token");
    signAuthToken.mockReturnValue("access-token");
  });

  test("signup creates a client and sends verification", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { sendVerificationEmail } = requireMock("../../../shared/services/emailService");
    const { rosterService } = requireMock("../../roster");

    identityRepository.findUserByEmail.mockResolvedValue(null);
    identityRepository.createUser.mockResolvedValue(baseUser);

    const result = await identityService.signup({
      role: "CLIENT",
      name: "Test User",
      nickname: "Tester",
      email: "Test@Example.com",
      password: "Passw0rd!"
    });

    expect(identityRepository.createUser).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        email: "test@example.com",
        biometricAuthEnabled: false
      })
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ token: "verify-token" })
    );
    expect(rosterService.populateForCompanion).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: baseUser.id,
        role: "CLIENT",
        emailVerified: false,
        biometricAuthEnabled: false
      })
    );
  });

  test("signup bypass mode marks emailVerified=true and skips verification email", async () => {
    const { config } = requireMock("../../../shared/config");
    const { identityRepository } = requireMock("../identity.repository");
    const { sendVerificationEmail } = requireMock("../../../shared/services/emailService");
    const { signEmailVerifyToken } = requireMock("../../../shared/utils/jwt");

    const previous = config.requireEmailVerification;
    config.requireEmailVerification = false;
    try {
      identityRepository.findUserByEmail.mockResolvedValue(null);
      identityRepository.createUser.mockResolvedValue({
        ...baseUser,
        emailVerified: true
      });

      const result = await identityService.signup({
        role: "CLIENT",
        name: "Test User",
        nickname: "Tester",
        email: "test@example.com",
        password: "Passw0rd!"
      });

      expect(identityRepository.createUser).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          emailVerified: true
        })
      );
      expect(signEmailVerifyToken).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.emailVerified).toBe(true);
    } finally {
      config.requireEmailVerification = previous;
    }
  });

  test("signup creates a companion profile and populates roster when venues exist", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { rosterService } = requireMock("../../roster");
    const { prisma } = requireMock("../../../shared/db/prisma");

    identityRepository.findUserByEmail.mockResolvedValue(null);
    identityRepository.countCompanionsByDesignation
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    identityRepository.createUser.mockResolvedValue({
      ...baseUser,
      id: "companion-user-1",
      role: "COMPANION" as const
    });
    identityRepository.createCompanionProfile.mockResolvedValue({
      id: "profile-1",
      userId: "companion-user-1",
      designation: "CAPTAIN"
    });
    prisma.venue.findMany.mockResolvedValue([
      { id: "venue-1" },
      { id: "venue-2" }
    ]);
    rosterService.populateForCompanion.mockResolvedValue({
      companionId: "companion-user-1",
      slotsCreated: 100
    });

    await identityService.signup({
      role: "COMPANION",
      name: "Test User",
      nickname: "Tester",
      email: "companion@example.com",
      password: "Passw0rd!",
      biometricAuthEnabled: true
    });

    expect(identityRepository.createCompanionProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ designation: "CAPTAIN" })
    );
    expect(prisma.venue.findMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(rosterService.populateForCompanion).toHaveBeenCalledWith({
      companionId: "companion-user-1",
      venueIds: ["venue-1", "venue-2"]
    });
  });

  test("signup creates a companion profile but does not populate roster when no venues exist", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { rosterService } = requireMock("../../roster");
    const { prisma } = requireMock("../../../shared/db/prisma");

    identityRepository.findUserByEmail.mockResolvedValue(null);
    identityRepository.countCompanionsByDesignation
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    identityRepository.createUser.mockResolvedValue({
      ...baseUser,
      id: "companion-user-2",
      role: "COMPANION" as const
    });
    identityRepository.createCompanionProfile.mockResolvedValue({
      id: "profile-2",
      userId: "companion-user-2",
      designation: "CAPTAIN"
    });
    prisma.venue.findMany.mockResolvedValue([]);

    await identityService.signup({
      role: "COMPANION",
      name: "Test User",
      nickname: "Tester",
      email: "companion2@example.com",
      password: "Passw0rd!",
      biometricAuthEnabled: false
    });

    expect(identityRepository.createCompanionProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ designation: "CAPTAIN" })
    );
    expect(prisma.venue.findMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(rosterService.populateForCompanion).not.toHaveBeenCalled();
  });

  test("signup rejects duplicate emails", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    identityRepository.findUserByEmail.mockResolvedValue(baseUser);

    await expect(
      identityService.signup({
        role: "CLIENT",
        name: "Test User",
        nickname: "Tester",
        email: "test@example.com",
        password: "Passw0rd!"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.EMAIL_ALREADY_EXISTS });
  });

  test("verifyEmail marks the user as verified", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { verifyEmailVerifyToken } = requireMock("../../../shared/utils/jwt");

    verifyEmailVerifyToken.mockReturnValue({ sub: "user-1" });
    identityRepository.findUserById.mockResolvedValue({
      ...baseUser,
      emailVerified: false
    });

    const result = await identityService.verifyEmail("token");

    expect(identityRepository.updateEmailVerified).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1"
    );
    expect(result).toEqual({ status: "VERIFIED" });
  });

  test("login returns an access token on success", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { verifyPassword } = requireMock("../../../shared/utils/password");
    const { __limiter } = requireMock("../../../shared/utils/rateLimiter");

    identityRepository.findUserByEmail.mockResolvedValue({
      ...baseUser,
      emailVerified: true
    });
    verifyPassword.mockResolvedValue(true);

    const result = await identityService.login({
      email: "test@example.com",
      password: "Passw0rd!"
    });

    expect(__limiter.reset).toHaveBeenCalledWith("test@example.com");
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: "access-token",
        user: expect.objectContaining({ email: "test@example.com" })
      })
    );
  });

  test("login rejects when email is not verified and verification is required", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { verifyPassword } = requireMock("../../../shared/utils/password");

    identityRepository.findUserByEmail.mockResolvedValue({
      ...baseUser,
      emailVerified: false
    });
    verifyPassword.mockResolvedValue(true);

    await expect(
      identityService.login({
        email: "test@example.com",
        password: "Passw0rd!"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.EMAIL_NOT_VERIFIED });
  });

  test("login bypass mode allows unverified user", async () => {
    const { config } = requireMock("../../../shared/config");
    const { identityRepository } = requireMock("../identity.repository");
    const { verifyPassword } = requireMock("../../../shared/utils/password");

    const previous = config.requireEmailVerification;
    config.requireEmailVerification = false;
    try {
      identityRepository.findUserByEmail.mockResolvedValue({
        ...baseUser,
        emailVerified: false
      });
      verifyPassword.mockResolvedValue(true);

      const result = await identityService.login({
        email: "test@example.com",
        password: "Passw0rd!"
      });

      expect(result).toEqual(
        expect.objectContaining({
          accessToken: "access-token",
          user: expect.objectContaining({ emailVerified: false })
        })
      );
    } finally {
      config.requireEmailVerification = previous;
    }
  });

  test("getMe includes companion profile when available", async () => {
    const { identityRepository } = requireMock("../identity.repository");

    identityRepository.findUserById.mockResolvedValue({
      ...baseUser,
      role: "COMPANION" as const
    });
    identityRepository.findCompanionProfileByUserId.mockResolvedValue(companionProfile);

    const result = await identityService.getMe("user-1");

    expect(result.companionProfile).toEqual(
      expect.objectContaining({
        id: "profile-1",
        designation: "CAPTAIN",
        averageRating: 4.25
      })
    );
  });

  test("login rejects invalid credentials", async () => {
    const { identityRepository } = requireMock("../identity.repository");
    const { verifyPassword } = requireMock("../../../shared/utils/password");
    const { __limiter } = requireMock("../../../shared/utils/rateLimiter");

    identityRepository.findUserByEmail.mockResolvedValue({
      ...baseUser,
      emailVerified: true
    });
    verifyPassword.mockResolvedValue(false);

    await expect(
      identityService.login({
        email: "test@example.com",
        password: "wrong"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CREDENTIALS });

    expect(__limiter.recordFailure).toHaveBeenCalledWith("test@example.com");
  });
});
