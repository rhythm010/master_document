import { Prisma } from "@prisma/client";

import type { DbClient } from "../../shared/db/prisma";

export const sessionInProgressRepository = {
  // Lock booking fields required for session extension / session auto-end eligibility.
  lockBookingForExtension: (db: DbClient, bookingId: string) =>
    db.$queryRaw<
      {
        id: string;
        status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
        clientId: string;
        endAt: Date;
        extendedAt: Date | null;
      }[]
    >(Prisma.sql`
      SELECT
        b.id,
        b.status,
        b.client_id as "clientId",
        b.end_at as "endAt",
        b.extended_at as "extendedAt"
      FROM "bookings" b
      WHERE b.id = ${bookingId}::uuid
      FOR UPDATE
    `),

  // Fetch booking + assignment context for in-session authorization checks.
  findBookingAuthContext: (db: DbClient, bookingId: string) =>
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        assignments: {
          select: {
            companionId: true,
            designation: true
          }
        }
      }
    }),

  // Fetch booking session metadata (including assignments) for the session endpoint.
  findBookingSessionContext: (db: DbClient, bookingId: string) =>
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        startAt: true,
        endAt: true,
        extendedAt: true,
        nearEndNotifiedAt: true,
        assignments: {
          select: {
            companionId: true,
            designation: true
          }
        }
      }
    }),

  // List booking messages ordered for polling reads.
  listBookingMessages: (db: DbClient, bookingId: string) =>
    db.bookingMessage.findMany({
      where: { bookingId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        bookingId: true,
        senderUserId: true,
        messageText: true,
        createdAt: true
      }
    }),

  // Create a booking message from an assigned companion sender.
  createBookingMessage: (db: DbClient, input: { bookingId: string; senderUserId: string; messageText: string }) =>
    db.bookingMessage.create({
      data: {
        bookingId: input.bookingId,
        senderUserId: input.senderUserId,
        messageText: input.messageText
      },
      select: {
        id: true,
        bookingId: true,
        senderUserId: true,
        messageText: true,
        createdAt: true
      }
    }),

  // Fetch a companion's booking assignment (used for authorization checks).
  findCompanionAssignmentForBooking: (db: DbClient, input: { bookingId: string; companionId: string }) =>
    db.bookingCompanionAssignment.findFirst({
      where: {
        bookingId: input.bookingId,
        companionId: input.companionId
      },
      select: {
        designation: true
      }
    })
};
