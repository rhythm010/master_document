import type { DbClient } from "../../shared/db/prisma";

export const companionProfileRepository = {
  // Fetch a companion profile by its owning user id.
  findByUserId: (db: DbClient, userId: string) =>
    db.companionProfile.findUnique({ where: { userId } }),
  // Update mutable profile fields.
  updateProfile: (
    db: DbClient,
    userId: string,
    data: { languages?: string[]; profilePictureUrl?: string }
  ) =>
    db.companionProfile.update({
      where: { userId },
      data
    }),
  // Flip the active state for the companion profile.
  updateActive: (db: DbClient, userId: string, isActive: boolean) =>
    db.companionProfile.update({
      where: { userId },
      data: { isActive }
    })
};
