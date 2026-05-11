import crypto from "node:crypto";

import { Prisma, type BookingRatingType } from "@prisma/client";

import type { DbClient } from "../../shared/db/prisma";

export const ratingsRepository = {
  // Fetch booking fields required for rating eligibility and authorization.
  findBookingForRating: (db: DbClient, bookingId: string) =>
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        startAt: true
      }
    }),

  // Check whether the companion is assigned to the booking.
  findCompanionAssignmentForBooking: (db: DbClient, input: { bookingId: string; companionId: string }) =>
    db.bookingCompanionAssignment.findUnique({
      where: {
        bookingId_companionId: {
          bookingId: input.bookingId,
          companionId: input.companionId
        }
      },
      select: {
        id: true
      }
    }),

  // Fetch the current database time (used for eligibility checks that must rely on DB clock).
  getDbNow: async (db: DbClient): Promise<Date> => {
    const rows = await db.$queryRaw<{ now: Date }[]>(Prisma.sql`SELECT now() as "now"`);
    const now = rows[0]?.now;
    if (!now) {
      throw new Error("Failed to load database time via SELECT now()");
    }
    return now;
  },

  // Insert a booking rating row without aborting the transaction on duplicates.
  // Returns the created row when inserted; returns null when a duplicate already exists.
  createBookingRating: async (
    db: DbClient,
    input: {
      bookingId: string;
      raterUserId: string;
      ratingType: BookingRatingType;
      stars: number | null;
      tags: string[];
      comment: string;
    }
  ): Promise<{
    id: string;
    bookingId: string;
    raterUserId: string;
    ratingType: BookingRatingType;
    stars: number | null;
    tags: string[];
    comment: string;
    createdAt: Date;
  } | null> => {
    const id = crypto.randomUUID();

    const rows = await db.$queryRaw<
      {
        id: string;
        bookingId: string;
        raterUserId: string;
        ratingType: BookingRatingType;
        stars: number | null;
        tags: string[];
        comment: string;
        createdAt: Date;
      }[]
    >(Prisma.sql`
      INSERT INTO booking_ratings (
        id,
        booking_id,
        rater_user_id,
        rating_type,
        stars,
        tags,
        comment
      )
      VALUES (
        ${id}::uuid,
        ${input.bookingId}::uuid,
        ${input.raterUserId}::uuid,
        ${input.ratingType}::"BookingRatingType",
        ${input.stars}::smallint,
        ${input.tags}::text[],
        ${input.comment}
      )
      ON CONFLICT (booking_id, rating_type, rater_user_id) DO NOTHING
      RETURNING
        id,
        booking_id as "bookingId",
        rater_user_id as "raterUserId",
        rating_type as "ratingType",
        stars,
        tags,
        comment,
        created_at as "createdAt";
    `);

    return rows[0] ?? null;
  },

  // Load the existing booking rating for the caller (used for retry-safe idempotency).
  findExistingBookingRating: (db: DbClient, input: {
    bookingId: string;
    ratingType: BookingRatingType;
    raterUserId: string;
  }) =>
    db.bookingRating.findUnique({
      where: {
        bookingId_ratingType_raterUserId: {
          bookingId: input.bookingId,
          ratingType: input.ratingType,
          raterUserId: input.raterUserId
        }
      },
      select: {
        id: true,
        bookingId: true,
        raterUserId: true,
        ratingType: true,
        stars: true,
        tags: true,
        comment: true,
        createdAt: true
      }
    }),

  // Load assigned companion ids for attribution.
  listBookingAssignments: (db: DbClient, bookingId: string) =>
    db.bookingCompanionAssignment.findMany({
      where: { bookingId },
      select: {
        companionId: true,
        designation: true
      }
    }),

  // Lock companion_profile rows for deterministic average recomputation.
  lockCompanionProfilesForUpdate: (db: DbClient, companionIds: string[]) =>
    db.$queryRaw<{ userId: string }[]>(Prisma.sql`
      SELECT cp.user_id as "userId"
      FROM "companion_profiles" cp
      WHERE cp.user_id IN (${Prisma.join(companionIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY cp.user_id
      FOR UPDATE
    `),

  // Recompute average_rating for the provided companions based on all client duo stars.
  recomputeCompanionAverageRatings: (db: DbClient, companionIds: string[]) =>
    db.$executeRaw(Prisma.sql`
      UPDATE companion_profiles cp
      SET average_rating = COALESCE((
        SELECT AVG(br.stars)::numeric(3,2)
        FROM booking_companion_assignments bca
        JOIN booking_ratings br
          ON br.booking_id = bca.booking_id
        WHERE bca.companion_id = cp.user_id
          AND br.rating_type = 'CLIENT_RATING_DUO'
          AND br.stars IS NOT NULL
      ), 0.00)
      WHERE cp.user_id IN (${Prisma.join(companionIds.map((id) => Prisma.sql`${id}::uuid`))})
    `),

  // Find the most recent terminal booking (by startAt desc, id desc) for the client
  // that is eligible for rating but is missing a CLIENT_RATING_DUO from that client.
  findMostRecentEligibleBookingMissingClientRating: (
    db: DbClient,
    input: { clientId: string; dbNow: Date }
  ) =>
    db.booking.findFirst({
      where: {
        clientId: input.clientId,
        status: {
          in: ["COMPLETED", "CANCELLED"]
        },
        OR: [
          { status: "COMPLETED" },
          { status: "CANCELLED", startAt: { lte: input.dbNow } }
        ],
        ratings: {
          none: {
            ratingType: "CLIENT_RATING_DUO",
            raterUserId: input.clientId
          }
        }
      },
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true
      }
    }),

  // Find the most recent terminal booking (by startAt desc, id desc) for the companion
  // that is eligible for rating but is missing a COMPANION_RATING_CLIENT from that companion.
  findMostRecentEligibleBookingMissingCompanionRating: (
    db: DbClient,
    input: { companionId: string; dbNow: Date }
  ) =>
    db.booking.findFirst({
      where: {
        status: {
          in: ["COMPLETED", "CANCELLED"]
        },
        OR: [
          { status: "COMPLETED" },
          { status: "CANCELLED", startAt: { lte: input.dbNow } }
        ],
        assignments: {
          some: {
            companionId: input.companionId
          }
        },
        ratings: {
          none: {
            ratingType: "COMPANION_RATING_CLIENT",
            raterUserId: input.companionId
          }
        }
      },
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true
      }
    })
};
