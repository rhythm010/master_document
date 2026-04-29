import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";

import { bookingService } from "../booking.service";
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

jest.mock("../../roster", () => ({
  rosterService: {
    reserveSlotsWithDb: jest.fn(),
    releaseSlotsWithDb: jest.fn()
  }
}));

jest.mock("../booking.repository", () => ({
  bookingRepository: {
    findVenueById: jest.fn(),
    findNonTerminalBookingForClient: jest.fn(),
    pickBookingColor: jest.fn(),
    createBooking: jest.fn(),
    findRosterSlotsByIds: jest.fn(),
    createAssignments: jest.fn(),
    lockBookingById: jest.fn(),
    isCompanionAssignedToBooking: jest.fn(),
    updateBookingStatus: jest.fn(),
    findBookingDetailsById: jest.fn(),
    findBookingCompanionPublicInfoByBookingId: jest.fn()
  }
}));

describe("bookingService", () => {
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

  test("createBooking creates booking and assignments", async () => {
    const { bookingRepository } = requireMock("../booking.repository");
    const { rosterService } = requireMock("../../roster");

    bookingRepository.findVenueById.mockResolvedValue({ id: "venue-1" });
    bookingRepository.findNonTerminalBookingForClient.mockResolvedValue(null);
    bookingRepository.pickBookingColor.mockResolvedValue("BLUE");

    const startAt = new Date("2026-04-26T10:00:00.000Z");
    const endAt = new Date("2026-04-26T12:00:00.000Z");
    const createdAt = new Date("2026-04-01T00:00:00.000Z");

    bookingRepository.createBooking.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      startAt,
      endAt,
      createdAt
    });

    rosterService.reserveSlotsWithDb.mockResolvedValue({
      reserved: true,
      captainSlotId: "slot-captain",
      viceCaptainSlotId: "slot-vice"
    });

    bookingRepository.findRosterSlotsByIds.mockResolvedValue([
      { id: "slot-captain", companionId: "companion-captain" },
      { id: "slot-vice", companionId: "companion-vice" }
    ]);

    bookingRepository.createAssignments.mockResolvedValue({ count: 2 });

    const result = await bookingService.createBooking({
      clientId: "client-1",
      venueId: "venue-1",
      startAt: startAt.toISOString()
    });

    expect(bookingRepository.createBooking).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        clientId: "client-1",
        venueId: "venue-1",
        status: "CONFIRMED",
        bookingColor: "BLUE",
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        qrCode: expect.any(String),
        pinCode: expect.any(String),
        comMatchQrCode: expect.any(String),
        comMatchPinCode: expect.any(String)
      })
    );

    expect(bookingRepository.createAssignments).toHaveBeenCalledWith(expect.any(Object), [
      {
        bookingId: "booking-1",
        companionId: "companion-captain",
        designation: "CAPTAIN"
      },
      {
        bookingId: "booking-1",
        companionId: "companion-vice",
        designation: "VICE_CAPTAIN"
      }
    ]);

    expect(result).toEqual({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      createdAt: createdAt.toISOString()
    });
  });

  test("createBooking returns 404 when venue missing", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    bookingRepository.findVenueById.mockResolvedValue(null);

    await expect(
      bookingService.createBooking({
        clientId: "client-1",
        venueId: "venue-1",
        startAt: "2026-04-26T10:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.VENUE_NOT_FOUND, statusCode: 404 });
  });

  test("createBooking returns 409 when client already has non-terminal booking", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    bookingRepository.findVenueById.mockResolvedValue({ id: "venue-1" });
    bookingRepository.findNonTerminalBookingForClient.mockResolvedValue({ id: "booking-existing" });

    await expect(
      bookingService.createBooking({
        clientId: "client-1",
        venueId: "venue-1",
        startAt: "2026-04-26T10:00:00.000Z"
      })
    ).rejects.toMatchObject({
      code: ErrorCodes.CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING,
      statusCode: 409
    });
  });

  test("cancelBooking is idempotent when already cancelled", async () => {
    const { bookingRepository } = requireMock("../booking.repository");
    const { rosterService } = requireMock("../../roster");

    bookingRepository.lockBookingById.mockResolvedValue([
      {
        id: "booking-1",
        status: "CANCELLED",
        clientId: "client-1"
      }
    ]);

    const result = await bookingService.cancelBooking({
      bookingId: "booking-1",
      caller: { id: "client-1", role: "CLIENT" }
    });

    expect(result).toEqual({ id: "booking-1", status: "CANCELLED" });
    expect(bookingRepository.updateBookingStatus).not.toHaveBeenCalled();
    expect(rosterService.releaseSlotsWithDb).not.toHaveBeenCalled();
  });

  test("cancelBooking rejects COMPLETED with INVALID_STATE_TRANSITION", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    bookingRepository.lockBookingById.mockResolvedValue([
      {
        id: "booking-1",
        status: "COMPLETED",
        clientId: "client-1"
      }
    ]);

    await expect(
      bookingService.cancelBooking({
        bookingId: "booking-1",
        caller: { id: "client-1", role: "CLIENT" }
      })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_STATE_TRANSITION, statusCode: 400 });
  });

  test("cancelBooking rejects companions not assigned with COMPANION_NOT_ASSIGNED", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    bookingRepository.lockBookingById.mockResolvedValue([
      {
        id: "booking-1",
        status: "ACTIVE",
        clientId: "client-1"
      }
    ]);

    bookingRepository.isCompanionAssignedToBooking.mockResolvedValue(false);

    await expect(
      bookingService.cancelBooking({
        bookingId: "booking-1",
        caller: { id: "companion-1", role: "COMPANION" }
      })
    ).rejects.toMatchObject({ code: ErrorCodes.COMPANION_NOT_ASSIGNED, statusCode: 403 });
  });

  test("getBookingDetails hides companions before reveal window", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    const startAt = new Date("2026-04-26T10:00:00.000Z");
    const endAt = new Date("2026-04-26T12:00:00.000Z");
    const createdAt = new Date("2026-04-01T00:00:00.000Z");

    bookingRepository.findBookingDetailsById.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      startAt,
      endAt,
      createdAt
    });

    const dateNowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(startAt.getTime() - 5 * 60 * 60 * 1000 - 1);

    try {
      const result = await bookingService.getBookingDetails({ bookingId: "booking-1", clientId: "client-1" });

      expect(bookingRepository.findBookingCompanionPublicInfoByBookingId).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: "booking-1",
        status: "CONFIRMED",
        clientId: "client-1",
        venueId: "venue-1",
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        createdAt: createdAt.toISOString(),
        companions: null
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  test("getBookingDetails reveals companions at T-5h boundary in CAPTAIN then VICE_CAPTAIN order", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    const startAt = new Date("2026-04-26T10:00:00.000Z");
    const endAt = new Date("2026-04-26T12:00:00.000Z");
    const createdAt = new Date("2026-04-01T00:00:00.000Z");

    bookingRepository.findBookingDetailsById.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      startAt,
      endAt,
      createdAt
    });

    bookingRepository.findBookingCompanionPublicInfoByBookingId.mockResolvedValue([
      {
        designation: "VICE_CAPTAIN",
        companion: {
          nickname: "vice",
          companionProfile: {
            languages: ["AR"],
            profilePictureUrl: "pic-vice",
            averageRating: "4.25"
          }
        }
      },
      {
        designation: "CAPTAIN",
        companion: {
          nickname: "captain",
          companionProfile: {
            languages: ["EN"],
            profilePictureUrl: "pic-captain",
            averageRating: "4.9"
          }
        }
      }
    ]);

    const dateNowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(startAt.getTime() - 5 * 60 * 60 * 1000);

    try {
      const result = await bookingService.getBookingDetails({ bookingId: "booking-1", clientId: "client-1" });

      expect(result.companions).toEqual([
        {
          designation: "CAPTAIN",
          displayName: "captain",
          languages: ["EN"],
          profilePictureUrl: "pic-captain",
          averageRating: 4.9
        },
        {
          designation: "VICE_CAPTAIN",
          displayName: "vice",
          languages: ["AR"],
          profilePictureUrl: "pic-vice",
          averageRating: 4.25
        }
      ]);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  test("getBookingDetails fails closed when assignments incomplete", async () => {
    const { bookingRepository } = requireMock("../booking.repository");
    const { logger } = requireMock("../../../shared/logger");

    const startAt = new Date("2026-04-26T10:00:00.000Z");
    const endAt = new Date("2026-04-26T12:00:00.000Z");
    const createdAt = new Date("2026-04-01T00:00:00.000Z");

    bookingRepository.findBookingDetailsById.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-1",
      venueId: "venue-1",
      startAt,
      endAt,
      createdAt
    });

    bookingRepository.findBookingCompanionPublicInfoByBookingId.mockResolvedValue([
      {
        designation: "CAPTAIN",
        companion: {
          nickname: "captain",
          companionProfile: {
            languages: ["EN"],
            profilePictureUrl: "pic-captain",
            averageRating: "4.9"
          }
        }
      }
    ]);

    const dateNowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(startAt.getTime() - 5 * 60 * 60 * 1000);

    try {
      const result = await bookingService.getBookingDetails({ bookingId: "booking-1", clientId: "client-1" });

      expect(bookingRepository.findBookingCompanionPublicInfoByBookingId).toHaveBeenCalledWith(
        expect.any(Object),
        "booking-1"
      );
      expect(result.companions).toBeNull();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "booking-1",
          missingCaptain: false,
          missingViceCaptain: true
        }),
        "booking companion assignments incomplete"
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  test("getBookingDetails forbids non-owner clients", async () => {
    const { bookingRepository } = requireMock("../booking.repository");

    bookingRepository.findBookingDetailsById.mockResolvedValue({
      id: "booking-1",
      status: "CONFIRMED",
      clientId: "client-owner",
      venueId: "venue-1",
      startAt: new Date("2026-04-26T10:00:00.000Z"),
      endAt: new Date("2026-04-26T12:00:00.000Z"),
      createdAt: new Date("2026-04-01T00:00:00.000Z")
    });

    await expect(
      bookingService.getBookingDetails({ bookingId: "booking-1", clientId: "client-other" })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });
  });
});
