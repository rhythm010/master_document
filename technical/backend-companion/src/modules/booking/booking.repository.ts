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
    })
};
