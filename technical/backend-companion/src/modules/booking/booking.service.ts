import { Prisma } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";

import { prisma } from "../../shared/db/prisma";
import { logger } from "../../shared/logger";
import type { UserRole } from "../../shared/types/enums";
import { rosterService } from "../roster";

import { bookingErrors } from "./booking.errors";
import { bookingRepository } from "./booking.repository";
import type {
  BookingDetailsDTO,
  BookingSummaryDTO,
  CancelBookingResponseDTO,
  CreateBookingRequestDTO
} from "./booking.types";

const BOOKING_DURATION_MS = 2 * 60 * 60 * 1000;

export const bookingService = {
  // Create a booking, reserve a roster duo, and create companion assignments.
  async createBooking(input: CreateBookingRequestDTO): Promise<BookingSummaryDTO> {
    const startAt = parseIsoInstant(input.startAt);
    const endAt = new Date(startAt.getTime() + BOOKING_DURATION_MS);

    try {
      const booking = await prisma.$transaction(async (tx) => {
        const venue = await bookingRepository.findVenueById(tx, input.venueId);
        if (!venue) {
          throw bookingErrors.venueNotFound();
        }

        const existing = await bookingRepository.findNonTerminalBookingForClient(tx, input.clientId);
        if (existing) {
          throw bookingErrors.clientAlreadyHasNonTerminalBooking();
        }

        const bookingColor = await bookingRepository.pickBookingColor(tx, input.venueId);

        const created = await bookingRepository.createBooking(tx, {
          clientId: input.clientId,
          venueId: input.venueId,
          startAt,
          endAt,
          status: "CONFIRMED",
          qrCode: randomUUID(),
          pinCode: generatePinCode(),
          bookingColor,
          comMatchQrCode: randomUUID(),
          comMatchPinCode: generatePinCode()
        });

        const reserved = await rosterService.reserveSlotsWithDb(tx, {
          venueId: input.venueId,
          startAt,
          endAt,
          bookingId: created.id
        });

        const rosterSlots = await bookingRepository.findRosterSlotsByIds(tx, [
          reserved.captainSlotId,
          reserved.viceCaptainSlotId
        ]);

        const captainSlot = rosterSlots.find((slot) => slot.id === reserved.captainSlotId);
        const viceSlot = rosterSlots.find((slot) => slot.id === reserved.viceCaptainSlotId);
        if (!captainSlot || !viceSlot) {
          throw new Error("Roster slots not found after reservation");
        }

        await bookingRepository.createAssignments(tx, [
          {
            bookingId: created.id,
            companionId: captainSlot.companionId,
            designation: "CAPTAIN"
          },
          {
            bookingId: created.id,
            companionId: viceSlot.companionId,
            designation: "VICE_CAPTAIN"
          }
        ]);

        return created;
      });

      logNotificationDeferred("BOOKING_CONFIRMED", booking.id);

      return {
        id: booking.id,
        status: booking.status,
        clientId: booking.clientId,
        venueId: booking.venueId,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        createdAt: booking.createdAt.toISOString()
      };
    } catch (error) {
      if (isClientNonTerminalBookingConstraintError(error)) {
        throw bookingErrors.clientAlreadyHasNonTerminalBooking();
      }

      throw error;
    }
  },

  // Cancel a booking and release roster slots.
  async cancelBooking(input: {
    bookingId: string;
    caller: { id: string; role: UserRole };
  }): Promise<CancelBookingResponseDTO> {
    const result = await prisma.$transaction(async (tx) => {
      const [booking] = await bookingRepository.lockBookingById(tx, input.bookingId);
      if (!booking) {
        throw bookingErrors.bookingNotFound();
      }

      await ensureCancelAuthorized(tx, {
        bookingId: booking.id,
        bookingClientId: booking.clientId,
        caller: input.caller
      });

      if (booking.status === "CANCELLED") {
        return { id: booking.id, status: "CANCELLED" } as const;
      }

      if (booking.status === "COMPLETED") {
        throw bookingErrors.invalidStateTransition();
      }

      await bookingRepository.updateBookingStatus(tx, booking.id, "CANCELLED");
      await rosterService.releaseSlotsWithDb(tx, booking.id);

      return { id: booking.id, status: "CANCELLED" } as const;
    });

    logNotificationDeferred("BOOKING_CANCELLED", result.id);

    return result;
  },

  // Return booking details for the owning client.
  async getBookingDetails(input: { bookingId: string; clientId: string }): Promise<BookingDetailsDTO> {
    const booking = await bookingRepository.findBookingDetailsById(prisma, input.bookingId);
    if (!booking) {
      throw bookingErrors.bookingNotFound();
    }

    if (booking.clientId !== input.clientId) {
      throw bookingErrors.forbidden();
    }

    return {
      id: booking.id,
      status: booking.status,
      clientId: booking.clientId,
      venueId: booking.venueId,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      createdAt: booking.createdAt.toISOString()
    };
  }
};

// Parse an ISO-8601 instant for timestamp inputs.
function parseIsoInstant(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw bookingErrors.invalidTimestamp();
  }
  return date;
}

// Generate a 6-digit numeric PIN code with leading zeros.
function generatePinCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Attempt to log a notification event without blocking booking flows.
function logNotificationDeferred(event: string, bookingId: string) {
  try {
    logger.info({ event, bookingId }, "notification deferred");
  } catch (_error) {
    // Intentionally ignore logging failures.
  }
}

// Map the custom partial unique index violation to a stable domain error.
function isClientNonTerminalBookingConstraintError(error: unknown) {
  const prismaError = error as { code?: string; meta?: { target?: unknown; constraint?: string } };
  if (!prismaError || prismaError.code !== "P2002") {
    return false;
  }

  const target = prismaError.meta?.target;
  const constraint = prismaError.meta?.constraint;
  if (typeof constraint === "string" && constraint.includes("uq_bookings_one_non_terminal_per_client")) {
    return true;
  }

  if (Array.isArray(target)) {
    return target.includes("uq_bookings_one_non_terminal_per_client") || target.includes("client_id");
  }

  if (typeof target === "string") {
    return target.includes("uq_bookings_one_non_terminal_per_client") || target.includes("client_id");
  }

  return true;
}

// Ensure a caller is authorized to cancel a booking.
async function ensureCancelAuthorized(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    bookingClientId: string;
    caller: { id: string; role: UserRole };
  }
) {
  if (input.caller.role === "CLIENT") {
    if (input.caller.id !== input.bookingClientId) {
      throw bookingErrors.forbidden();
    }
    return;
  }

  if (input.caller.role === "COMPANION") {
    const assigned = await bookingRepository.isCompanionAssignedToBooking(tx, {
      bookingId: input.bookingId,
      companionId: input.caller.id
    });

    if (!assigned) {
      throw bookingErrors.companionNotAssigned();
    }

    return;
  }

  throw bookingErrors.forbidden();
}
