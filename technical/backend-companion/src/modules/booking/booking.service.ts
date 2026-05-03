import { Prisma } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";

import { prisma } from "../../shared/db/prisma";
import { logger } from "../../shared/logger";
import type { CompanionDesignation, UserRole } from "../../shared/types/enums";
import { rosterService } from "../roster";

import { bookingErrors } from "./booking.errors";
import { bookingRepository } from "./booking.repository";
import type {
  BookingCompanionPublicInfoDTO,
  BookingDetailsDTO,
  BookingMessageDTO,
  BookingSessionResponseDTO,
  BookingSummaryDTO,
  CancelBookingResponseDTO,
  CreateBookingMessageResponseDTO,
  CreateBookingRequestDTO,
  ExtendBookingResponseDTO,
  ListBookingMessagesResponseDTO
} from "./booking.types";

const BOOKING_DURATION_MS = 2 * 60 * 60 * 1000;
const COMPANION_REVEAL_WINDOW_MS = 5 * 60 * 60 * 1000;

const MESSAGE_ALLOWED_COMPANION_DESIGNATIONS: CompanionDesignation[] = ["CAPTAIN", "VICE_CAPTAIN"];

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
        bookingStatus: booking.status,
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

  // Extend an active session by +1 hour (client owner only).
  async extendBooking(input: { bookingId: string; clientId: string }): Promise<ExtendBookingResponseDTO> {
    const result = await prisma.$transaction(async (tx) => {
      const [booking] = await bookingRepository.lockBookingForExtension(tx, input.bookingId);
      if (!booking) {
        throw bookingErrors.bookingNotFound();
      }

      if (booking.status !== "ACTIVE") {
        throw bookingErrors.invalidStateTransition();
      }

      if (booking.clientId !== input.clientId) {
        throw bookingErrors.forbidden();
      }

      if (booking.extendedAt) {
        throw bookingErrors.invalidStateTransition();
      }

      const now = new Date();
      const endAt = new Date(booking.endAt.getTime() + 60 * 60 * 1000);

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endAt,
          extendedAt: now
        },
        select: {
          id: true,
          status: true,
          endAt: true,
          extendedAt: true
        }
      });

      if (!updated.extendedAt) {
        throw bookingErrors.internalError("Extension succeeded but extendedAt was null");
      }

      return updated;
    });

    return {
      id: result.id,
      status: "ACTIVE",
      endAt: result.endAt.toISOString(),
      extendedAt: result.extendedAt!.toISOString()
    };
  },

  // Trigger an SOS event (stub; no side effects).
  async sosBooking(input: {
    bookingId: string;
    caller: { id: string; role: UserRole };
  }): Promise<Record<string, never>> {
    const booking = await bookingRepository.findBookingAuthContext(prisma, input.bookingId);
    if (!booking) {
      throw bookingErrors.bookingNotFound();
    }

    if (booking.status !== "ACTIVE") {
      throw bookingErrors.invalidStateTransition();
    }

    const isOwnerClient = input.caller.role === "CLIENT" && input.caller.id === booking.clientId;
    const isAssignedCompanion =
      input.caller.role === "COMPANION" &&
      booking.assignments.some((row) => row.companionId === input.caller.id);

    if (!isOwnerClient && !isAssignedCompanion) {
      throw bookingErrors.forbidden();
    }

    return {};
  },

  // Return booking session metadata for the client or assigned companions.
  async getBookingSession(input: {
    bookingId: string;
    caller: { id: string; role: UserRole };
  }): Promise<BookingSessionResponseDTO> {
    const booking = await bookingRepository.findBookingSessionContext(prisma, input.bookingId);
    if (!booking) {
      throw bookingErrors.bookingNotFound();
    }

    const isOwnerClient = input.caller.role === "CLIENT" && input.caller.id === booking.clientId;
    const callerAssignment = booking.assignments.find((row) => row.companionId === input.caller.id);
    const isAssignedCompanion = input.caller.role === "COMPANION" && Boolean(callerAssignment);

    if (!isOwnerClient && !isAssignedCompanion) {
      throw bookingErrors.forbidden();
    }

    if (booking.status === "CONFIRMED") {
      throw bookingErrors.invalidStateTransition();
    }

    if (booking.status !== "ACTIVE" && booking.status !== "COMPLETED" && booking.status !== "CANCELLED") {
      throw bookingErrors.invalidStateTransition();
    }

    const status = booking.status;
    const myDesignation = isAssignedCompanion ? callerAssignment!.designation : null;

    return {
      id: booking.id,
      status,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      extendedAt: booking.extendedAt ? booking.extendedAt.toISOString() : null,
      nearEndNotifiedAt: booking.nearEndNotifiedAt ? booking.nearEndNotifiedAt.toISOString() : null,
      myDesignation
    };
  },

  // List captain↔vice session messages for an active booking.
  async listBookingMessages(input: {
    bookingId: string;
    companionId: string;
  }): Promise<ListBookingMessagesResponseDTO> {
    const booking = await bookingRepository.findBookingAuthContext(prisma, input.bookingId);
    if (!booking) {
      throw bookingErrors.bookingNotFound();
    }

    if (booking.status !== "ACTIVE") {
      throw bookingErrors.invalidStateTransition();
    }

    const callerAssignment = booking.assignments.find((row) => row.companionId === input.companionId);
    const allowed = callerAssignment && isMessageAllowedDesignation(callerAssignment.designation);
    if (!allowed) {
      throw bookingErrors.forbidden();
    }

    const rows = await bookingRepository.listBookingMessages(prisma, booking.id);

    const messages: BookingMessageDTO[] = rows.map((row) => ({
      id: row.id,
      bookingId: row.bookingId,
      senderUserId: row.senderUserId,
      content: row.messageText,
      createdAt: row.createdAt.toISOString()
    }));

    return {
      bookingId: booking.id,
      messages
    };
  },

  // Create a captain↔vice session message for an active booking.
  async createBookingMessage(input: {
    bookingId: string;
    companionId: string;
    content: string;
  }): Promise<CreateBookingMessageResponseDTO> {
    const result = await prisma.$transaction(async (tx) => {
      const [booking] = await bookingRepository.lockBookingById(tx, input.bookingId);
      if (!booking) {
        throw bookingErrors.bookingNotFound();
      }

      if (booking.status !== "ACTIVE") {
        throw bookingErrors.invalidStateTransition();
      }

      const assignment = await bookingRepository.findCompanionAssignmentForBooking(tx, {
        bookingId: booking.id,
        companionId: input.companionId
      });

      if (!assignment || !isMessageAllowedDesignation(assignment.designation)) {
        throw bookingErrors.forbidden();
      }

      return bookingRepository.createBookingMessage(tx, {
        bookingId: booking.id,
        senderUserId: input.companionId,
        messageText: input.content
      });
    });

    return {
      id: result.id,
      bookingId: result.bookingId,
      senderUserId: result.senderUserId,
      content: result.messageText,
      createdAt: result.createdAt.toISOString()
    };
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

    const response: BookingDetailsDTO = {
      id: booking.id,
      status: booking.status,
      clientId: booking.clientId,
      venueId: booking.venueId,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      companions: null
    };

    const revealUnlocked = isCompanionRevealUnlocked(booking.startAt);
    const statusBlocksReveal = booking.status === "CANCELLED" || booking.status === "COMPLETED";

    if (!revealUnlocked || statusBlocksReveal) {
      return response;
    }

    const assignments = await bookingRepository.findBookingCompanionPublicInfoByBookingId(prisma, booking.id);

    const companions = mapBookingCompanionPublicInfo({ bookingId: booking.id, rows: assignments });

    return {
      ...response,
      companions: companions ?? null
    };
  },

  // Internal-only edit of a booking (CONFIRMED only) with atomic release+reserve+assignment update.
  async internalEditBooking(input: {
    bookingId: string;
    venueId?: string;
    startAt?: string;
    captainCompanionId?: string;
    viceCaptainCompanionId?: string;
  }): Promise<BookingSummaryDTO> {
    const parsedStartAt = input.startAt ? parseIsoInstant(input.startAt) : undefined;

    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const result = await prisma.$transaction(async (tx) =>
          internalEditBookingCore(tx, {
            bookingId: input.bookingId,
            venueId: input.venueId,
            startAt: parsedStartAt,
            captainCompanionId: input.captainCompanionId,
            viceCaptainCompanionId: input.viceCaptainCompanionId
          })
        );

        return {
          id: result.id,
          status: result.status,
          clientId: result.clientId,
          venueId: result.venueId,
          startAt: result.startAt.toISOString(),
          endAt: result.endAt.toISOString(),
          createdAt: result.createdAt.toISOString()
        };
      } catch (error) {
        const retriesRemaining = attempt < maxAttempts - 1;
        if (!retriesRemaining || !isRetryableInternalEditError(error)) {
          throw error;
        }

        await sleepWithJitter({ baseMs: 25, jitterMs: 50 });
      }
    }

    throw bookingErrors.internalError("Internal edit retries exhausted");
  }
};

type BookingCompanionPublicInfoRow = Awaited<
  ReturnType<typeof bookingRepository.findBookingCompanionPublicInfoByBookingId>
>[number];

// Determine whether companion public info is unlocked for the client.
function isCompanionRevealUnlocked(startAt: Date) {
  return Date.now() >= startAt.getTime() - COMPANION_REVEAL_WINDOW_MS;
}

// Determine whether a booking message endpoint is authorized for a specific assignment designation.
function isMessageAllowedDesignation(designation: CompanionDesignation) {
  return MESSAGE_ALLOWED_COMPANION_DESIGNATIONS.includes(designation);
}

// Map DB rows to the client-visible companion public info shape.
function mapBookingCompanionPublicInfo(input: {
  bookingId: string;
  rows: BookingCompanionPublicInfoRow[];
}): BookingCompanionPublicInfoDTO[] | null {
  const captain = input.rows.find((row) => row.designation === "CAPTAIN");
  const viceCaptain = input.rows.find((row) => row.designation === "VICE_CAPTAIN");

  if (!captain || !viceCaptain) {
    logger.info(
      {
        bookingId: input.bookingId,
        missingCaptain: !captain,
        missingViceCaptain: !viceCaptain
      },
      "booking companion assignments incomplete"
    );

    return null;
  }

  const companionRows = [captain, viceCaptain];
  const companions: BookingCompanionPublicInfoDTO[] = [];

  for (const row of companionRows) {
    const profile = row.companion.companionProfile;
    if (!profile) {
      logger.info(
        {
          bookingId: input.bookingId,
          designation: row.designation
        },
        "booking companion profile missing"
      );

      return null;
    }

    companions.push({
      designation: row.designation,
      displayName: row.companion.nickname,
      languages: profile.languages,
      profilePictureUrl: profile.profilePictureUrl,
      averageRating: Number(profile.averageRating)
    });
  }

  return companions;
}

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
  } catch {
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
    bookingStatus: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
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
    if (input.bookingStatus === "ACTIVE") {
      throw bookingErrors.forbidden();
    }

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

// Perform the internal edit workflow inside a caller-owned transaction.
async function internalEditBookingCore(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    venueId?: string;
    startAt?: Date;
    captainCompanionId?: string;
    viceCaptainCompanionId?: string;
  }
) {
  const [booking] = await bookingRepository.lockBookingForInternalEdit(tx, input.bookingId);
  if (!booking) {
    throw bookingErrors.bookingNotFound();
  }

  if (booking.status !== "CONFIRMED") {
    throw bookingErrors.invalidStateTransition();
  }

  if (booking.extendedAt) {
    throw bookingErrors.invalidStateTransition();
  }

  const now = new Date();
  if (now.getTime() >= booking.startAt.getTime()) {
    throw bookingErrors.invalidStateTransition();
  }

  if (input.venueId) {
    const venue = await bookingRepository.findVenueById(tx, input.venueId);
    if (!venue) {
      throw bookingErrors.venueNotFound();
    }
  }

  const assignments = await bookingRepository.lockAssignmentsForBooking(tx, booking.id);
  const captainAssignment = assignments.find((row) => row.designation === "CAPTAIN");
  const viceAssignment = assignments.find((row) => row.designation === "VICE_CAPTAIN");

  if (assignments.length !== 2 || !captainAssignment || !viceAssignment) {
    throw bookingErrors.invalidStateTransition();
  }

  for (const row of assignments) {
    const isDefaultStatuses =
      row.presenceStatus === "ASSIGNED" &&
      row.selfMatchStatus === "NOT_MATCHED" &&
      row.clientMatchStatus === "WAITING_FOR_CLIENT";

    if (!isDefaultStatuses) {
      throw bookingErrors.invalidStateTransition();
    }
  }

  const targetVenueId = input.venueId ?? booking.venueId;
  const targetStartAt = input.startAt ?? booking.startAt;

  if (now.getTime() >= targetStartAt.getTime()) {
    throw bookingErrors.invalidStateTransition();
  }

  const targetEndAt = new Date(targetStartAt.getTime() + BOOKING_DURATION_MS);

  const hasCaptainOverride = input.captainCompanionId !== undefined;
  const hasViceOverride = input.viceCaptainCompanionId !== undefined;
  if (hasCaptainOverride !== hasViceOverride) {
    throw bookingErrors.validationError(
      "Both captainCompanionId and viceCaptainCompanionId must be provided together"
    );
  }

  const currentCaptainId = captainAssignment.companionId;
  const currentViceCaptainId = viceAssignment.companionId;

  let targetCaptainId = currentCaptainId;
  let targetViceCaptainId = currentViceCaptainId;

  if (hasCaptainOverride && hasViceOverride) {
    if (input.captainCompanionId === input.viceCaptainCompanionId) {
      throw bookingErrors.validationError("captainCompanionId and viceCaptainCompanionId must be distinct");
    }

    const [captainDesignation, viceDesignation] = await Promise.all([
      bookingRepository.findCompanionDesignation(tx, input.captainCompanionId!),
      bookingRepository.findCompanionDesignation(tx, input.viceCaptainCompanionId!)
    ]);

    if (captainDesignation !== "CAPTAIN") {
      throw bookingErrors.validationError("captainCompanionId must refer to a CAPTAIN");
    }

    if (viceDesignation !== "VICE_CAPTAIN") {
      throw bookingErrors.validationError("viceCaptainCompanionId must refer to a VICE_CAPTAIN");
    }

    targetCaptainId = input.captainCompanionId!;
    targetViceCaptainId = input.viceCaptainCompanionId!;
  }

  // Release current slots inside this transaction so edit operations remain atomic.
  const released = await rosterService.releaseSlotsWithDb(tx, booking.id);
  if (released.slotsReleased !== 2) {
    throw bookingErrors.internalError("Unexpected roster slot release count");
  }

  // Lock both target slots deterministically to avoid deadlocks.
  const lockedSlots = await bookingRepository.lockAvailableRosterSlotsForCompanions(tx, {
    venueId: targetVenueId,
    startAt: targetStartAt,
    endAt: targetEndAt,
    companionIds: [targetCaptainId, targetViceCaptainId]
  });

  if (lockedSlots.length !== 2) {
    throw bookingErrors.noDuoAvailable();
  }

  const slotIds = lockedSlots.map((slot) => slot.id);
  const booked = await bookingRepository.bookRosterSlotsForBooking(tx, {
    slotIds,
    bookingId: booking.id
  });

  if ((booked.count ?? 0) !== 2) {
    throw bookingErrors.noDuoAvailable();
  }

  const updatedBooking = await bookingRepository.updateBookingVenueTime(tx, booking.id, {
    venueId: targetVenueId,
    startAt: targetStartAt,
    endAt: targetEndAt
  });

  const duoChanged =
    targetCaptainId !== currentCaptainId || targetViceCaptainId !== currentViceCaptainId;

  if (duoChanged) {
    await bookingRepository.deleteAssignmentsForBooking(tx, booking.id);
    await bookingRepository.createAssignments(tx, [
      {
        bookingId: booking.id,
        companionId: targetCaptainId,
        designation: "CAPTAIN"
      },
      {
        bookingId: booking.id,
        companionId: targetViceCaptainId,
        designation: "VICE_CAPTAIN"
      }
    ]);
  }

  return updatedBooking;
}

// Determine whether an internal edit transaction error should trigger a retry.
function isRetryableInternalEditError(error: unknown) {
  const maybeAppError = error as { statusCode?: unknown; code?: unknown };
  if (typeof maybeAppError?.statusCode === "number" && typeof maybeAppError?.code === "string") {
    return false;
  }

  const prismaError = error as { code?: unknown; meta?: { code?: unknown } };

  // Prisma wraps deadlocks/serialization failures in P2034 for interactive transactions.
  if (prismaError?.code === "P2034") {
    return true;
  }

  // Raw query failures often expose the Postgres SQLSTATE on meta.code.
  const sqlState = prismaError?.meta?.code;
  if (sqlState === "40P01" || sqlState === "40001") {
    return true;
  }

  // As a fallback, honor errors that surface SQLSTATE directly.
  if (prismaError?.code === "40P01" || prismaError?.code === "40001") {
    return true;
  }

  return false;
}

// Sleep for a small jittered backoff duration between retry attempts.
async function sleepWithJitter(input: { baseMs: number; jitterMs: number }) {
  const jitter = Math.floor(Math.random() * (input.jitterMs + 1));
  const delayMs = input.baseMs + jitter;

  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), delayMs);
  });
}
