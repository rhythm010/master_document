import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";

import { matchingService } from "../matching.service";
import { ErrorCodes } from "../../../shared/errors/errorCodes";

const requireMock = (moduleName: string) => jest.requireMock(moduleName) as any;

jest.mock("../../../shared/db/prisma", () => ({
  prisma: {
    $transaction: jest.fn()
  }
}));

jest.mock("../../../shared/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock("../matching.repository", () => ({
  matchingRepository: {
    findBookingById: jest.fn(),
    findVenueById: jest.fn(),
    findParticipantLocation: jest.fn(),
    upsertParticipantLocation: jest.fn(),
    findAssignmentsForBooking: jest.fn(),
    lockBookingById: jest.fn(),
    lockAssignmentsForBooking: jest.fn(),
    updateClientMatchStatusForBooking: jest.fn(),
    updateBookingStatus: jest.fn()
  }
}));

describe("matchingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const { prisma } = requireMock("../../../shared/db/prisma");
    prisma.$transaction.mockImplementation(async (callback: jest.Mock) => {
      const tx = {};
      return callback(tx);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("startClientMatch rejects when GPS permission is missing", async () => {
    await expect(
      matchingService.startClientMatch({
        bookingId: "booking-1",
        clientId: "client-1",
        latitude: 25.2,
        longitude: 55.3,
        gpsPermissionGranted: false,
        gpsEnabled: true
      })
    ).rejects.toMatchObject({ code: ErrorCodes.GPS_PERMISSION_REQUIRED, statusCode: 400 });
  });

  test("startClientMatch rejects when client is outside venue radius", async () => {
    const { matchingRepository } = requireMock("../matching.repository");

    matchingRepository.findBookingById.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      qrCode: "qr",
      pinCode: "pin",
      comMatchQrCode: "cqr",
      comMatchPinCode: "cpin"
    });
    matchingRepository.findAssignmentsForBooking.mockResolvedValue([
      {
        designation: "CAPTAIN",
        companionId: "companion-1",
        presenceStatus: "ARRIVED",
        selfMatchStatus: "NOT_MATCHED",
        clientMatchStatus: "WAITING_FOR_CLIENT"
      },
      {
        designation: "VICE_CAPTAIN",
        companionId: "companion-2",
        presenceStatus: "ARRIVED",
        selfMatchStatus: "NOT_MATCHED",
        clientMatchStatus: "WAITING_FOR_CLIENT"
      }
    ]);
    matchingRepository.findParticipantLocation.mockResolvedValue(null);
    matchingRepository.findVenueById.mockResolvedValue({
      id: "venue-1",
      latitude: 0,
      longitude: 0
    });

    await expect(
      matchingService.startClientMatch({
        bookingId: "booking-1",
        clientId: "client-1",
        latitude: 25.2,
        longitude: 55.3,
        gpsPermissionGranted: true,
        gpsEnabled: true
      })
    ).rejects.toMatchObject({ code: ErrorCodes.OUTSIDE_VENUE_RADIUS, statusCode: 400 });
  });

  test("updateMatchingLocation rejects when client match not started", async () => {
    const { matchingRepository } = requireMock("../matching.repository");

    matchingRepository.findBookingById.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      qrCode: "qr",
      pinCode: "pin",
      comMatchQrCode: "cqr",
      comMatchPinCode: "cpin"
    });
    matchingRepository.findAssignmentsForBooking.mockResolvedValue([
      {
        designation: "CAPTAIN",
        companionId: "companion-1",
        presenceStatus: "ARRIVED",
        selfMatchStatus: "NOT_MATCHED",
        clientMatchStatus: "WAITING_FOR_CLIENT"
      },
      {
        designation: "VICE_CAPTAIN",
        companionId: "companion-2",
        presenceStatus: "ARRIVED",
        selfMatchStatus: "NOT_MATCHED",
        clientMatchStatus: "WAITING_FOR_CLIENT"
      }
    ]);
    matchingRepository.findParticipantLocation.mockResolvedValue(null);

    await expect(
      matchingService.updateMatchingLocation({
        bookingId: "booking-1",
        caller: { id: "client-1", role: "CLIENT" },
        latitude: 25.2,
        longitude: 55.3,
        gpsPermissionGranted: true,
        gpsEnabled: true
      })
    ).rejects.toMatchObject({ code: ErrorCodes.CLIENT_MATCH_NOT_STARTED, statusCode: 400 });
  });

  test("verifyClientMatch rejects when self match incomplete", async () => {
    const { matchingRepository } = requireMock("../matching.repository");

    matchingRepository.lockBookingById.mockResolvedValue([
      {
        id: "booking-1",
        status: "CONFIRMED",
        clientId: "client-1",
        venueId: "venue-1",
        qrCode: "qr",
        pinCode: "pin",
        comMatchQrCode: "cqr",
        comMatchPinCode: "cpin"
      }
    ]);
    matchingRepository.lockAssignmentsForBooking.mockResolvedValue([
      {
        id: "assign-1",
        designation: "CAPTAIN",
        companionId: "companion-1",
        presenceStatus: "ARRIVED",
        selfMatchStatus: "NOT_MATCHED",
        clientMatchStatus: "WAITING_FOR_CLIENT"
      },
      {
        id: "assign-2",
        designation: "VICE_CAPTAIN",
        companionId: "companion-2",
        presenceStatus: "ARRIVED",
        selfMatchStatus: "NOT_MATCHED",
        clientMatchStatus: "WAITING_FOR_CLIENT"
      }
    ]);

    await expect(
      matchingService.verifyClientMatch({
        bookingId: "booking-1",
        companionId: "companion-1",
        verificationMethod: "QR",
        qrCode: "qr"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.SELF_MATCH_INCOMPLETE, statusCode: 400 });
  });
});
