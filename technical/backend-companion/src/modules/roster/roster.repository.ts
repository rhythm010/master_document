import type { DbClient } from "../../shared/db/prisma";

export const rosterRepository = {
  listVenues: (db: DbClient) => db.venue.findMany(),
  createCompanionVenueAssignments: (
    db: DbClient,
    data: { companionId: string; venueId: string }[]
  ) =>
    db.companionVenueAssignment.createMany({
      data,
      skipDuplicates: true
    }),
  createRosterSlots: (
    db: DbClient,
    data: {
      venueId: string;
      companionId: string;
      startAt: Date;
      endAt: Date;
      status: "AVAILABLE" | "BOOKED";
    }[]
  ) =>
    db.rosterSlot.createMany({
      data,
      skipDuplicates: true
    })
};
