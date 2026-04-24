import type { DbClient } from "../../shared/db/prisma";
import type { CompanionDesignation, UserRole } from "../../shared/types/enums";

export const identityRepository = {
  findUserByEmail: (db: DbClient, email: string) =>
    db.user.findUnique({ where: { email } }),
  findUserById: (db: DbClient, id: string) => db.user.findUnique({ where: { id } }),
  updateEmailVerified: (db: DbClient, id: string) =>
    db.user.update({ where: { id }, data: { emailVerified: true } }),
  updateNickname: (db: DbClient, id: string, nickname: string) =>
    db.user.update({ where: { id }, data: { nickname } }),
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
  countCompanionsByDesignation: (db: DbClient, designation: CompanionDesignation) =>
    db.companionProfile.count({ where: { designation } }),
  findCompanionProfileByUserId: (db: DbClient, userId: string) =>
    db.companionProfile.findUnique({ where: { userId } })
};
