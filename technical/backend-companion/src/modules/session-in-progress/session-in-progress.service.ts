import { prisma } from "../../shared/db/prisma";
import type { CompanionDesignation, UserRole } from "../../shared/types/enums";

import { bookingRepository } from "../booking/booking.repository";

import { sessionInProgressErrors } from "./session-in-progress.errors";
import { sessionInProgressRepository } from "./session-in-progress.repository";
import type {
  BookingMessageDTO,
  BookingSessionResponseDTO,
  CreateBookingMessageResponseDTO,
  ExtendBookingResponseDTO,
  ListBookingMessagesResponseDTO,
  SosBookingResponseDTO
} from "./session-in-progress.types";

const MESSAGE_ALLOWED_COMPANION_DESIGNATIONS: CompanionDesignation[] = ["CAPTAIN", "VICE_CAPTAIN"];

export const sessionInProgressService = {
  // Extend an active session by +1 hour (client owner only).
  async extendBooking(input: { bookingId: string; clientId: string }): Promise<ExtendBookingResponseDTO> {
    const result = await prisma.$transaction(async (tx) => {
      const [booking] = await sessionInProgressRepository.lockBookingForExtension(tx, input.bookingId);
      if (!booking) {
        throw sessionInProgressErrors.bookingNotFound();
      }

      if (booking.status !== "ACTIVE") {
        throw sessionInProgressErrors.invalidStateTransition();
      }

      if (booking.clientId !== input.clientId) {
        throw sessionInProgressErrors.forbidden();
      }

      if (booking.extendedAt) {
        throw sessionInProgressErrors.invalidStateTransition();
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
        throw sessionInProgressErrors.internalError("Extension succeeded but extendedAt was null");
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
  async sosBooking(input: { bookingId: string; caller: { id: string; role: UserRole } }): Promise<SosBookingResponseDTO> {
    const booking = await sessionInProgressRepository.findBookingAuthContext(prisma, input.bookingId);
    if (!booking) {
      throw sessionInProgressErrors.bookingNotFound();
    }

    if (booking.status !== "ACTIVE") {
      throw sessionInProgressErrors.invalidStateTransition();
    }

    const isOwnerClient = input.caller.role === "CLIENT" && input.caller.id === booking.clientId;
    const isAssignedCompanion =
      input.caller.role === "COMPANION" && booking.assignments.some((row) => row.companionId === input.caller.id);

    if (!isOwnerClient && !isAssignedCompanion) {
      throw sessionInProgressErrors.forbidden();
    }

    return {};
  },

  // Return booking session metadata for the client or assigned companions.
  async getBookingSession(input: {
    bookingId: string;
    caller: { id: string; role: UserRole };
  }): Promise<BookingSessionResponseDTO> {
    const booking = await sessionInProgressRepository.findBookingSessionContext(prisma, input.bookingId);
    if (!booking) {
      throw sessionInProgressErrors.bookingNotFound();
    }

    const isOwnerClient = input.caller.role === "CLIENT" && input.caller.id === booking.clientId;
    const callerAssignment = booking.assignments.find((row) => row.companionId === input.caller.id);
    const isAssignedCompanion = input.caller.role === "COMPANION" && Boolean(callerAssignment);

    if (!isOwnerClient && !isAssignedCompanion) {
      throw sessionInProgressErrors.forbidden();
    }

    if (booking.status === "CONFIRMED") {
      throw sessionInProgressErrors.invalidStateTransition();
    }

    if (booking.status !== "ACTIVE" && booking.status !== "COMPLETED" && booking.status !== "CANCELLED") {
      throw sessionInProgressErrors.invalidStateTransition();
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
  async listBookingMessages(input: { bookingId: string; companionId: string }): Promise<ListBookingMessagesResponseDTO> {
    const booking = await sessionInProgressRepository.findBookingAuthContext(prisma, input.bookingId);
    if (!booking) {
      throw sessionInProgressErrors.bookingNotFound();
    }

    if (booking.status !== "ACTIVE") {
      throw sessionInProgressErrors.invalidStateTransition();
    }

    const callerAssignment = booking.assignments.find((row) => row.companionId === input.companionId);
    const allowed = callerAssignment && isMessageAllowedDesignation(callerAssignment.designation);
    if (!allowed) {
      throw sessionInProgressErrors.forbidden();
    }

    const rows = await sessionInProgressRepository.listBookingMessages(prisma, booking.id);

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
        throw sessionInProgressErrors.bookingNotFound();
      }

      if (booking.status !== "ACTIVE") {
        throw sessionInProgressErrors.invalidStateTransition();
      }

      const assignment = await sessionInProgressRepository.findCompanionAssignmentForBooking(tx, {
        bookingId: booking.id,
        companionId: input.companionId
      });

      if (!assignment || !isMessageAllowedDesignation(assignment.designation)) {
        throw sessionInProgressErrors.forbidden();
      }

      return sessionInProgressRepository.createBookingMessage(tx, {
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
  }
};

function isMessageAllowedDesignation(designation: CompanionDesignation): boolean {
  return MESSAGE_ALLOWED_COMPANION_DESIGNATIONS.includes(designation);
}

