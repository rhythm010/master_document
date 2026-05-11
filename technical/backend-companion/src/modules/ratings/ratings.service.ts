import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../shared/db/prisma";
import { prisma } from "../../shared/db/prisma";

import { ratingsErrors } from "./ratings.errors";
import { ratingsRepository } from "./ratings.repository";
import type {
  BookingRatingDTO,
  BookingRatingStatusDTO,
  CreateBookingRatingInput,
  CreateBookingRatingResult
} from "./ratings.types";

export const ratingsService = {
  // Create an immutable booking rating for the caller (client or assigned companion).
  async createBookingRating(input: CreateBookingRatingInput): Promise<CreateBookingRatingResult> {
    return prisma.$transaction(async (tx) => {
      const booking = await ratingsRepository.findBookingForRating(tx, input.bookingId);
      if (!booking) {
        throw ratingsErrors.bookingNotFound();
      }

      await ensureBookingEligibleForRating(tx, booking.status, booking.startAt);

      const ratingType = await inferRatingTypeAndAuthorize(tx, {
        bookingId: booking.id,
        bookingClientId: booking.clientId,
        caller: input.caller
      });

      const tags = normalizeTags(input.tags);
      const commentNormalized = normalizeComment(input.comment);
      const starsNormalized = normalizeStars(input.stars, input.caller.role);

      const created = await ratingsRepository.createBookingRating(tx, {
        bookingId: booking.id,
        raterUserId: input.caller.id,
        ratingType,
        stars: starsNormalized,
        tags,
        comment: commentNormalized
      });

      if (created) {
        if (created.ratingType === "CLIENT_RATING_DUO" && created.stars !== null) {
          await recomputeCompanionAveragesForBooking(tx, booking.id);
        }

        return {
          status: 201,
          rating: toBookingRatingDTO(created)
        };
      }

      const existing = await ratingsRepository.findExistingBookingRating(tx, {
        bookingId: booking.id,
        ratingType,
        raterUserId: input.caller.id
      });

      if (!existing) {
        throw ratingsErrors.internalError(
          "Booking rating insert returned no row, but no existing booking rating row was found"
        );
      }

      return {
        status: 200,
        rating: toBookingRatingDTO(existing)
      };
    });
  },

  // Return eligibility + submission status for rating a booking.
  async getBookingRatingStatus(input: {
    bookingId: string;
    caller: { id: string; role: "CLIENT" | "COMPANION" };
  }): Promise<BookingRatingStatusDTO> {
    const booking = await ratingsRepository.findBookingForRating(prisma, input.bookingId);
    if (!booking) {
      throw ratingsErrors.bookingNotFound();
    }

    const dbNow = await ratingsRepository.getDbNow(prisma);

    const ratingType = await inferRatingTypeAndAuthorize(prisma, {
      bookingId: booking.id,
      bookingClientId: booking.clientId,
      caller: input.caller
    });

    const eligibility = computeRatingEligibility({
      status: booking.status,
      startAt: booking.startAt,
      dbNow
    });

    const existing = await ratingsRepository.findExistingBookingRating(prisma, {
      bookingId: booking.id,
      ratingType,
      raterUserId: input.caller.id
    });

    const mostRecentMissing =
      input.caller.role === "CLIENT"
        ? await ratingsRepository.findMostRecentEligibleBookingMissingClientRating(prisma, {
            clientId: input.caller.id,
            dbNow
          })
        : await ratingsRepository.findMostRecentEligibleBookingMissingCompanionRating(prisma, {
            companionId: input.caller.id,
            dbNow
          });

    return {
      bookingId: booking.id,
      callerUserId: input.caller.id,
      callerRole: input.caller.role,
      ratingType,
      eligibleForRating: eligibility.eligibleForRating,
      eligibilityReason: eligibility.reason,
      hasSubmitted: Boolean(existing),
      ratingId: existing?.id ?? null,
      ratingCreatedAt: existing ? existing.createdAt.toISOString() : null,
      ratingNeeded: mostRecentMissing ? mostRecentMissing.id === booking.id : false
    };
  }
};

function toBookingRatingDTO(row: {
  id: string;
  bookingId: string;
  raterUserId: string;
  ratingType: "CLIENT_RATING_DUO" | "COMPANION_RATING_CLIENT";
  stars: number | null;
  tags: string[];
  comment: string;
  createdAt: Date;
}): BookingRatingDTO {
  return {
    id: row.id,
    bookingId: row.bookingId,
    raterUserId: row.raterUserId,
    ratingType: row.ratingType,
    stars: row.stars,
    tags: row.tags,
    comment: row.comment,
    createdAt: row.createdAt.toISOString()
  };
}

async function ensureBookingEligibleForRating(
  db: Prisma.TransactionClient,
  status: string,
  startAt: Date
): Promise<void> {
  if (status === "COMPLETED") {
    return;
  }

  if (status === "CANCELLED") {
    const dbNow = await ratingsRepository.getDbNow(db);
    if (startAt.getTime() <= dbNow.getTime()) {
      return;
    }
    throw ratingsErrors.invalidStateTransition();
  }

  throw ratingsErrors.invalidStateTransition();
}

// Determine whether a booking is currently eligible for rating submission.
function computeRatingEligibility(input: {
  status: string;
  startAt: Date;
  dbNow: Date;
}): { eligibleForRating: boolean; reason: string } {
  if (input.status === "COMPLETED") {
    return { eligibleForRating: true, reason: "COMPLETED" };
  }

  if (input.status === "CANCELLED") {
    const started = input.startAt.getTime() <= input.dbNow.getTime();
    return started
      ? { eligibleForRating: true, reason: "CANCELLED_STARTED" }
      : { eligibleForRating: false, reason: "CANCELLED_NOT_STARTED" };
  }

  return { eligibleForRating: false, reason: "STATUS_NOT_ELIGIBLE" };
}

async function inferRatingTypeAndAuthorize(
  db: DbClient,
  input: {
    bookingId: string;
    bookingClientId: string;
    caller: { id: string; role: "CLIENT" | "COMPANION" };
  }
): Promise<"CLIENT_RATING_DUO" | "COMPANION_RATING_CLIENT"> {
  if (input.caller.role === "CLIENT") {
    if (input.bookingClientId !== input.caller.id) {
      throw ratingsErrors.forbidden();
    }

    return "CLIENT_RATING_DUO";
  }

  const assignment = await ratingsRepository.findCompanionAssignmentForBooking(db, {
    bookingId: input.bookingId,
    companionId: input.caller.id
  });

  if (!assignment) {
    throw ratingsErrors.forbidden();
  }

  return "COMPANION_RATING_CLIENT";
}

function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags) || tags.length < 1) {
    throw ratingsErrors.validationError("tags must contain at least 1 element");
  }

  return tags;
}

function normalizeComment(comment: string | null | undefined): string {
  const normalized = comment ?? "";

  if (normalized.length > 300) {
    throw ratingsErrors.validationError("comment must be at most 300 characters");
  }

  return normalized;
}

function normalizeStars(
  stars: number | null | undefined,
  role: "CLIENT" | "COMPANION"
): number | null {
  if (stars === undefined || stars === null) {
    if (role === "COMPANION") {
      throw ratingsErrors.validationError("stars is required for companion ratings");
    }

    return null;
  }

  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw ratingsErrors.validationError("stars must be an integer between 1 and 5");
  }

  return stars;
}

async function recomputeCompanionAveragesForBooking(db: Prisma.TransactionClient, bookingId: string): Promise<void> {
  const assignments = await ratingsRepository.listBookingAssignments(db, bookingId);
  const captain = assignments.find((row) => row.designation === "CAPTAIN");
  const viceCaptain = assignments.find((row) => row.designation === "VICE_CAPTAIN");

  if (!captain || !viceCaptain) {
    throw ratingsErrors.internalError("Booking does not have both CAPTAIN and VICE_CAPTAIN assignments");
  }

  const companionIds = [captain.companionId, viceCaptain.companionId];
  const stableIds = [...new Set(companionIds)].sort();

  const locked = await ratingsRepository.lockCompanionProfilesForUpdate(db, stableIds);
  if (locked.length !== stableIds.length) {
    throw ratingsErrors.internalError("Companion profile rows were missing for average recomputation");
  }

  await ratingsRepository.recomputeCompanionAverageRatings(db, stableIds);
}
