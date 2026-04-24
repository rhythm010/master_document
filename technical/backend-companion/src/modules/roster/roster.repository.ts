import type { DbClient } from "../../shared/db/prisma";

export const rosterRepository = {
  // List all venues so slots can be generated per venue.
  listVenues: (db: DbClient) => db.venue.findMany(),
  // Create companion-to-venue assignments in bulk.
  createCompanionVenueAssignments: (
    db: DbClient,
    data: { companionId: string; venueId: string }[]
  ) =>
    db.companionVenueAssignment.createMany({
      data,
      skipDuplicates: true
    }),
  // Create roster slots in bulk for the given companion and venue.
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
