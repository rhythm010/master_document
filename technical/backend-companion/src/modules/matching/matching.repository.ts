import { Prisma } from "@prisma/client";

import type { DbClient } from "../../shared/db/prisma";

export const matchingRepository = {
  // Fetch booking + assignments + companion data for matching context.
  findMatchingContextByBookingId: (db: DbClient, bookingId: string) =>
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        bookingColor: true,
        qrCode: true,
        pinCode: true,
        comMatchQrCode: true,
        comMatchPinCode: true,
        clientId: true,
        venueId: true,
        client: {
          select: {
            nickname: true
          }
        },
        assignments: {
          select: {
            designation: true,
            companionId: true,
            presenceStatus: true,
            selfMatchStatus: true,
            clientMatchStatus: true,
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
        }
      }
    }),

  // Fetch a booking for basic validations.
  findBookingById: (db: DbClient, bookingId: string) =>
    db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        venueId: true,
        qrCode: true,
        pinCode: true,
        comMatchQrCode: true,
        comMatchPinCode: true
      }
    }),

  // Fetch a venue with GPS coordinates.
  findVenueById: (db: DbClient, venueId: string) =>
    db.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        latitude: true,
        longitude: true
      }
    }),

  // List booking companion assignments for authorization checks.
  findAssignmentsForBooking: (db: DbClient, bookingId: string) =>
    db.bookingCompanionAssignment.findMany({
      where: { bookingId },
      select: {
        designation: true,
        companionId: true,
        presenceStatus: true,
        selfMatchStatus: true,
        clientMatchStatus: true
      }
    }),

  // Fetch a participant's last known location for a booking.
  findParticipantLocation: (db: DbClient, input: { bookingId: string; userId: string }) =>
    db.bookingParticipantLocation.findUnique({
      where: {
        bookingId_userId: {
          bookingId: input.bookingId,
          userId: input.userId
        }
      },
      select: {
        bookingId: true,
        userId: true,
        latitude: true,
        longitude: true,
        updatedAt: true
      }
    }),

  // List all participant locations for a booking.
  listParticipantLocations: (db: DbClient, bookingId: string) =>
    db.bookingParticipantLocation.findMany({
      where: { bookingId },
      select: {
        userId: true,
        latitude: true,
        longitude: true,
        updatedAt: true
      }
    }),

  // Upsert the participant location for a booking.
  upsertParticipantLocation: (
    db: DbClient,
    input: {
      bookingId: string;
      userId: string;
      latitude: number;
      longitude: number;
      updatedAt: Date;
    }
  ) =>
    db.bookingParticipantLocation.upsert({
      where: {
        bookingId_userId: {
          bookingId: input.bookingId,
          userId: input.userId
        }
      },
      update: {
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt: input.updatedAt
      },
      create: {
        bookingId: input.bookingId,
        userId: input.userId,
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt: input.updatedAt
      },
      select: {
        bookingId: true,
        userId: true,
        latitude: true,
        longitude: true,
        updatedAt: true
      }
    }),

  // Lock a booking row for match verification.
  lockBookingById: (db: DbClient, bookingId: string) =>
    db.$queryRaw<
      {
        id: string;
        status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
        clientId: string;
        venueId: string;
        qrCode: string;
        pinCode: string;
        comMatchQrCode: string;
        comMatchPinCode: string;
      }[]
    >(Prisma.sql`
      SELECT
        b.id,
        b.status,
        b.client_id as "clientId",
        b.venue_id as "venueId",
        b.qr_code as "qrCode",
        b.pin_code as "pinCode",
        b.com_match_qr_code as "comMatchQrCode",
        b.com_match_pin_code as "comMatchPinCode"
      FROM "bookings" b
      WHERE b.id = ${bookingId}::uuid
      FOR UPDATE
    `),

  // Lock companion assignments for match verification.
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

  // Update self-match status for a booking's assignments.
  updateSelfMatchStatusForBooking: (
    db: DbClient,
    bookingId: string,
    status: "MATCHED"
  ) =>
    db.bookingCompanionAssignment.updateMany({
      where: { bookingId },
      data: { selfMatchStatus: status }
    }),

  // Update client-match status for a booking's assignments.
  updateClientMatchStatusForBooking: (
    db: DbClient,
    bookingId: string,
    status: "CLIENT_MATCHED"
  ) =>
    db.bookingCompanionAssignment.updateMany({
      where: { bookingId },
      data: { clientMatchStatus: status }
    }),

  // Update booking status to ACTIVE.
  updateBookingStatus: (db: DbClient, bookingId: string, status: "ACTIVE") =>
    db.booking.update({
      where: { id: bookingId },
      data: { status },
      select: { id: true, status: true }
    })
};
