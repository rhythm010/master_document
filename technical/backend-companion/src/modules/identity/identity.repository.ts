import type { DbClient } from "../../shared/db/prisma";
import type { CompanionDesignation, UserRole } from "../../shared/types/enums";

export const identityRepository = {
  // Look up a user by email for login/signup checks.
  findUserByEmail: (db: DbClient, email: string) =>
    db.user.findUnique({ where: { email } }),
  // Fetch a user by id for profile or auth flows.
  findUserById: (db: DbClient, id: string) => db.user.findUnique({ where: { id } }),
  // Mark a user's email as verified.
  updateEmailVerified: (db: DbClient, id: string) =>
    db.user.update({ where: { id }, data: { emailVerified: true } }),
  // Update the user's public nickname.
  updateNickname: (db: DbClient, id: string, nickname: string) =>
    db.user.update({ where: { id }, data: { nickname } }),
  // Create a new user record.
  createUser: (db: DbClient, input: {
    id: string;
    role: UserRole;
    name: string;
    nickname: string;
    email: string;
    passwordHash: string;
    emailVerified: boolean;
    biometricAuthEnabled: boolean;
  }) =>
    db.user.create({
      data: {
        id: input.id,
        role: input.role,
        name: input.name,
        nickname: input.nickname,
        email: input.email,
        passwordHash: input.passwordHash,
        emailVerified: input.emailVerified,
        biometricAuthEnabled: input.biometricAuthEnabled
      }
    }),
  // Create a companion profile tied to a user id.
  createCompanionProfile: (db: DbClient, input: {
    id: string;
    userId: string;
    designation: CompanionDesignation;
  }) =>
    db.companionProfile.create({
      data: {
        id: input.id,
        userId: input.userId,
        designation: input.designation
      }
    }),
  // Count companions by designation to balance assignments.
  countCompanionsByDesignation: (db: DbClient, designation: CompanionDesignation) =>
    db.companionProfile.count({ where: { designation } }),
  // Fetch a companion profile for the given user id.
  findCompanionProfileByUserId: (db: DbClient, userId: string) =>
    db.companionProfile.findUnique({ where: { userId } })
};
