import { Prisma } from "@prisma/client";

import type { DbClient } from "../../shared/db/prisma";
import type { CompanionDesignation } from "../../shared/types/enums";

export const rosterRepository = {
  // Search partnered venues by case-insensitive substring.
  searchVenues: (db: DbClient, query: string, limit: number) =>
    db.venue.findMany({
      where: {
        name: {
          contains: query,
          mode: "insensitive"
        }
      },
      orderBy: {
        name: "asc"
      },
      take: limit
    }),
  // Fetch a single venue by id.
  findVenueById: (db: DbClient, venueId: string) =>
    db.venue.findUnique({ where: { id: venueId } }),
  // Fetch a set of venues by their ids.
  findVenuesByIds: (db: DbClient, venueIds: string[]) =>
    db.venue.findMany({ where: { id: { in: venueIds } } }),
  // Fetch a user row for companion validation.
  findUserById: (db: DbClient, userId: string) => db.user.findUnique({ where: { id: userId } }),
  // List companion ids currently assigned to a venue.
  listCompanionIdsAssignedToVenue: async (db: DbClient, venueId: string) => {
    const rows = await db.companionVenueAssignment.findMany({
      where: { venueId },
      select: { companionId: true }
    });
    return rows.map((row) => row.companionId);
  },
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
    }),
  // Return available windows that have at least one CAPTAIN and one VICE_CAPTAIN.
  listAvailableWindows: (
    db: DbClient,
    input: { venueId: string; openAt: Date; closeAt: Date }
  ) =>
    db.$queryRaw<
      {
        startAt: Date;
        endAt: Date;
        captainCount: number;
        viceCaptainCount: number;
      }[]
    >(Prisma.sql`
      SELECT
        rs.start_at as "startAt",
        rs.end_at as "endAt",
        COUNT(DISTINCT CASE WHEN cp.designation = 'CAPTAIN' THEN rs.companion_id END) as "captainCount",
        COUNT(DISTINCT CASE WHEN cp.designation = 'VICE_CAPTAIN' THEN rs.companion_id END) as "viceCaptainCount"
      FROM "roster_slots" rs
      JOIN "companion_profiles" cp
        ON rs.companion_id = cp.user_id
      JOIN "companion_venue_assignments" cva
        ON cva.companion_id = rs.companion_id
       AND cva.venue_id = rs.venue_id
      WHERE rs.venue_id = ${input.venueId}::uuid
        AND rs.status = 'AVAILABLE'
        AND rs.start_at >= ${input.openAt}::timestamptz
        AND rs.end_at <= ${input.closeAt}::timestamptz
        AND rs.end_at = rs.start_at + interval '2 hours'
      GROUP BY rs.start_at, rs.end_at
      HAVING COUNT(DISTINCT CASE WHEN cp.designation = 'CAPTAIN' THEN rs.companion_id END) >= 1
         AND COUNT(DISTINCT CASE WHEN cp.designation = 'VICE_CAPTAIN' THEN rs.companion_id END) >= 1
      ORDER BY rs.start_at ASC
    `),
  // Lock and return one available slot id for a designation.
  lockOneSlotForDesignation: (
    db: DbClient,
    input: {
      venueId: string;
      startAt: Date;
      endAt: Date;
      designation: CompanionDesignation;
    }
  ) =>
    db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT rs.id
      FROM "roster_slots" rs
      JOIN "companion_profiles" cp
        ON rs.companion_id = cp.user_id
      JOIN "companion_venue_assignments" cva
        ON cva.companion_id = rs.companion_id
       AND cva.venue_id = rs.venue_id
      WHERE rs.venue_id = ${input.venueId}::uuid
        AND rs.start_at = ${input.startAt}::timestamptz
        AND rs.end_at = ${input.endAt}::timestamptz
        AND rs.status = 'AVAILABLE'
        AND cp.designation = ${input.designation}::"CompanionDesignation"
      LIMIT 1
      FOR UPDATE OF rs SKIP LOCKED
    `),
  // Mark roster slots as booked for a booking id.
  bookSlotsForBooking: (db: DbClient, input: { slotIds: string[]; bookingId: string }) =>
    db.rosterSlot.updateMany({
      where: {
        id: { in: input.slotIds },
        status: "AVAILABLE"
      },
      data: {
        status: "BOOKED",
        bookingId: input.bookingId
      }
    }),
  // Release roster slots for the booking id.
  releaseSlotsForBooking: (db: DbClient, bookingId: string) =>
    db.rosterSlot.updateMany({
      where: { bookingId },
      data: {
        status: "AVAILABLE",
        bookingId: null
      }
    })
};
