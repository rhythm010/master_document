import type { DbClient } from "../../shared/db/prisma";

export const companionProfileRepository = {
  findByUserId: (db: DbClient, userId: string) =>
    db.companionProfile.findUnique({ where: { userId } }),
  updateProfile: (
    db: DbClient,
    userId: string,
    data: { languages?: string[]; profilePictureUrl?: string }
  ) =>
    db.companionProfile.update({
      where: { userId },
      data
    }),
  updateActive: (db: DbClient, userId: string, isActive: boolean) =>
    db.companionProfile.update({
      where: { userId },
      data: { isActive }
    })
};
