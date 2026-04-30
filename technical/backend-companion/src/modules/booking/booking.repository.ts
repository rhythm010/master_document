import { Prisma } from "@prisma/client";

import type { DbClient } from "../../shared/db/prisma";

const BOOKING_COLOR_PALETTE = [
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
  "PURPLE",
  "ORANGE",
  "PINK",
  "TEAL",
  "INDIGO",
  "LIME",
  "AMBER",
  "CYAN"
] as const;

export const bookingRepository = {
  // Fetch a venue by id.
  findVenueById: (db: DbClient, venueId: string) => db.venue.findUnique({ where: { id: venueId } }),

  // Return an existing non-terminal booking for the given client, if one exists.
  findNonTerminalBookingForClient: (db: DbClient, clientId: string) =>
    db.booking.findFirst({
      where: {
        clientId,
        status: {
          in: ["CONFIRMED", "ACTIVE"]
        }
      },
      select: {
        id: true
      }
    }),

  // List booking colors currently used by non-terminal bookings at a venue.
  listUsedBookingColorsForVenue: async (db: DbClient, venueId: string) => {
    const rows = await db.booking.findMany({
      where: {
        venueId,
        status: {
          in: ["CONFIRMED", "ACTIVE"]
        }
      },
      select: {
        bookingColor: true
      }
    });

    return rows.map((row) => row.bookingColor);
  },

  // Pick the first unused color for the venue, falling back to RED.
  pickBookingColor: async (db: DbClient, venueId: string) => {
    const used = await bookingRepository.listUsedBookingColorsForVenue(db, venueId);
    const usedSet = new Set(used);

    const candidate = BOOKING_COLOR_PALETTE.find((color) => !usedSet.has(color));
    return candidate ?? "RED";
  },

  // Create a booking row with generated artifacts.
  createBooking: (
    db: DbClient,
    data: {
      clientId: string;
      venueId: string;
      startAt: Date;
      endAt: Date;
      status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
      qrCode: string;
      pinCode: string;
      bookingColor: string;
      comMatchQrCode: string;
      comMatchPinCode: string;
    }
  ) =>
    db.booking.create({
      data,
      select: {
        id: true,
        status: true,
        clientId: true,
        venueId: true,
        startAt: true,
        endAt: true,
        createdAt: true
      }
    }),

  // Fetch roster slots by id and return companion ids.
  findRosterSlotsByIds: (db: DbClient, slotIds: string[]) =>
    db.rosterSlot.findMany({
      where: {
        id: { in: slotIds }
      },
      select: {
        id: true,
        companionId: true
      }
    }),

  // Create booking companion assignments in bulk.
  createAssignments: (
    db: DbClient,
    data: { bookingId: string; companionId: string; designation: "CAPTAIN" | "VICE_CAPTAIN" }[]
  ) =>
    db.bookingCompanionAssignment.createMany({
      data
    }),

  // Lock and return a booking row for update (SELECT ... FOR UPDATE).
  lockBookingById: (db: DbClient, bookingId: string) =>
    db.$queryRaw<
      {
        id: string;
        status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
        clientId: string;
      }[]
    >(Prisma.sql`
      SELECT b.id, b.status, b.client_id as "clientId"
      FROM "bookings" b
      WHERE b.id = ${bookingId}::uuid
      FOR UPDATE
    `),

  // Check whether a companion is assigned to a booking.
  isCompanionAssignedToBooking: async (
    db: DbClient,
    input: { bookingId: string; companionId: string }
  ) => {
    const row = await db.bookingCompanionAssignment.findFirst({
      where: {
        bookingId: input.bookingId,
        companionId: input.companionId
      },
      select: {
        id: true
      }
    });

    return Boolean(row);
  },

  // Update booking status.
  updateBookingStatus: (db: DbClient, bookingId: string, status: "CANCELLED") =>
    db.booking.update({
      where: { id: bookingId },
      data: { status },
      select: { id: true, status: true }
    }),

  // Fetch booking details by id.
  findBookingDetailsById: (db: DbClient, bookingId: string) =>
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        venueId: true,
        startAt: true,
        endAt: true,
        createdAt: true
      }
    }),

  // Fetch companion public info for a booking (no PII; used for client reveal window UI).
  findBookingCompanionPublicInfoByBookingId: (db: DbClient, bookingId: string) =>
    db.bookingCompanionAssignment.findMany({
      where: {
        bookingId
      },
      select: {
        designation: true,
        companion: {
          select: {
            nickname: true,
            companionProfile: {
              select: {
                languages: true,
                profilePictureUrl: true,
                averageRating: true
              }
            }
          }
        }
      }
    }),

  // Lock and return booking fields required for internal edits.
  lockBookingForInternalEdit: (db: DbClient, bookingId: string) =>
    db.$queryRaw<
      {
        id: string;
        status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
        clientId: string;
        venueId: string;
        startAt: Date;
        endAt: Date;
        extendedAt: Date | null;
        createdAt: Date;
      }[]
    >(Prisma.sql`
      SELECT
        b.id,
        b.status,
        b.client_id as "clientId",
        b.venue_id as "venueId",
        b.start_at as "startAt",
        b.end_at as "endAt",
        b.extended_at as "extendedAt",
        b.created_at as "createdAt"
      FROM "bookings" b
      WHERE b.id = ${bookingId}::uuid
      FOR UPDATE
    `),

  // Lock and return assignment rows for internal edit precondition checks.
  lockAssignmentsForBooking: (db: DbClient, bookingId: string) =>
    db.$queryRaw<
      {
        id: string;
        designation: "CAPTAIN" | "VICE_CAPTAIN";
        companionId: string;
        presenceStatus: "ASSIGNED" | "ARRIVED";
        selfMatchStatus: "NOT_MATCHED" | "MATCHED";
        clientMatchStatus: "WAITING_FOR_CLIENT" | "CLIENT_MATCHED";
      }[]
    >(Prisma.sql`
      SELECT
        bca.id,
        bca.designation,
        bca.companion_id as "companionId",
        bca.presence_status as "presenceStatus",
        bca.self_match_status as "selfMatchStatus",
        bca.client_match_status as "clientMatchStatus"
      FROM "booking_companion_assignments" bca
      WHERE bca.booking_id = ${bookingId}::uuid
      FOR UPDATE
    `),

  // Fetch a companion's stored designation for internal validation.
  findCompanionDesignation: async (db: DbClient, companionId: string) => {
    const profile = await db.companionProfile.findUnique({
      where: { userId: companionId },
      select: { designation: true }
    });

    return profile?.designation ?? null;
  },

  // Lock AVAILABLE roster slots for a specific duo/window in a single deterministic statement.
  lockAvailableRosterSlotsForCompanions: (
    db: DbClient,
    input: { venueId: string; startAt: Date; endAt: Date; companionIds: [string, string] }
  ) =>
    db.$queryRaw<{ id: string; companionId: string }[]>(Prisma.sql`
      SELECT rs.id, rs.companion_id as "companionId"
      FROM "roster_slots" rs
      WHERE rs.venue_id = ${input.venueId}::uuid
        AND rs.start_at = ${input.startAt}::timestamptz
        AND rs.end_at = ${input.endAt}::timestamptz
        AND rs.status = 'AVAILABLE'
        AND rs.companion_id IN (${Prisma.join(
          input.companionIds.map((companionId) => Prisma.sql`${companionId}::uuid`)
        )})
      FOR UPDATE OF rs SKIP LOCKED
    `),

  // Book a set of locked roster slots for the given booking.
  bookRosterSlotsForBooking: (db: DbClient, input: { slotIds: string[]; bookingId: string }) =>
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

  // Update booking venue/start/end without touching any booking artifacts.
  updateBookingVenueTime: (
    db: DbClient,
    bookingId: string,
    input: { venueId: string; startAt: Date; endAt: Date }
  ) =>
    db.booking.update({
      where: { id: bookingId },
      data: {
        venueId: input.venueId,
        startAt: input.startAt,
        endAt: input.endAt
      },
      select: {
        id: true,
        status: true,
        clientId: true,
        venueId: true,
        startAt: true,
        endAt: true,
        createdAt: true
      }
    }),

  // Remove existing companion assignments for the booking.
  deleteAssignmentsForBooking: (db: DbClient, bookingId: string) =>
    db.bookingCompanionAssignment.deleteMany({
      where: {
        bookingId
      }
    })
};
