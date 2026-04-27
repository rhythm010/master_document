import { describe, test, expect, beforeEach, jest } from "@jest/globals";

import { rosterService } from "../roster.service";
import { ErrorCodes } from "../../../shared/errors/errorCodes";
import { combineDateAndTime } from "../../../shared/utils/time";

const requireMock = (moduleName: string) => jest.requireMock(moduleName) as any;

jest.mock("../../../shared/db/prisma", () => ({
  prisma: {
    $transaction: jest.fn()
  }
}));

jest.mock("../roster.repository", () => ({
  rosterRepository: {
    lockOneSlotForDesignation: jest.fn(),
    bookSlotsForBooking: jest.fn(),
    releaseSlotsForBooking: jest.fn(),
    createRosterSlots: jest.fn(),
    createCompanionVenueAssignments: jest.fn(),
    findUserById: jest.fn(),
    findVenueById: jest.fn(),
    findVenuesByIds: jest.fn(),
    listCompanionIdsAssignedToVenue: jest.fn(),
    listAvailableWindows: jest.fn(),
    searchVenues: jest.fn()
  }
}));

describe("rosterService.getAvailability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns durationMinutes=120 and empty availableStartTimes when venue hours are invalid", async () => {
    const { rosterRepository } = requireMock("../roster.repository");

    rosterRepository.findVenueById.mockResolvedValue({
      operatingHoursStart: new Date("1970-01-01T20:00:00.000Z"),
      operatingHoursEnd: new Date("1970-01-01T08:00:00.000Z")
    });

    const result = await rosterService.getAvailability({
      venueId: "00000000-0000-0000-0000-000000000000",
      date: "2026-04-26"
    });

    expect(result).toEqual({
      venueId: "00000000-0000-0000-0000-000000000000",
      date: "2026-04-26",
      durationMinutes: 120,
      availableStartTimes: []
    });

    expect(rosterRepository.listCompanionIdsAssignedToVenue).not.toHaveBeenCalled();
    expect(rosterRepository.createRosterSlots).not.toHaveBeenCalled();
    expect(rosterRepository.listAvailableWindows).not.toHaveBeenCalled();
  });

  test("backfills slots starting on the next 30-minute boundary when operatingHoursStart is not aligned", async () => {
    const { rosterRepository } = requireMock("../roster.repository");

    const operatingHoursStart = new Date("1970-01-01T10:10:00.000Z");
    const operatingHoursEnd = new Date("1970-01-01T13:00:00.000Z");

    rosterRepository.findVenueById.mockResolvedValue({
      operatingHoursStart,
      operatingHoursEnd
    });
    rosterRepository.listCompanionIdsAssignedToVenue.mockResolvedValue(["companion-1"]);
    rosterRepository.createRosterSlots.mockResolvedValue({ count: 2 });
    rosterRepository.listAvailableWindows.mockResolvedValue([]);

    await rosterService.getAvailability({
      venueId: "00000000-0000-0000-0000-000000000000",
      date: "2026-04-26"
    });

    const [, slots] = rosterRepository.createRosterSlots.mock.calls[0] as [unknown, any[]];

    const dateValue = new Date("2026-04-26T00:00:00");
    const openAt = combineDateAndTime(dateValue, operatingHoursStart);

    expect(slots).toHaveLength(2);
    expect(slots[0].startAt.getTime()).toBe(openAt.getTime() + 20 * 60 * 1000);
    expect(slots[0].startAt.getMinutes() % 30).toBe(0);
    expect(slots[1].startAt.getMinutes() % 30).toBe(0);
  });
});

describe("rosterService.populateForCompanion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates slots aligned to 30-minute boundaries when operatingHoursStart is not aligned", async () => {
    const { rosterRepository } = requireMock("../roster.repository");

    rosterRepository.findUserById.mockResolvedValue({ role: "COMPANION" });
    rosterRepository.findVenuesByIds.mockResolvedValue([
      {
        id: "venue-1",
        operatingHoursStart: new Date("1970-01-01T10:10:00.000Z"),
        operatingHoursEnd: new Date("1970-01-01T13:00:00.000Z")
      }
    ]);
    rosterRepository.createCompanionVenueAssignments.mockResolvedValue({ count: 1 });
    rosterRepository.createRosterSlots.mockResolvedValue({ count: 14 });

    const result = await rosterService.populateForCompanion({
      companionId: "00000000-0000-0000-0000-000000000001",
      venueIds: ["00000000-0000-0000-0000-000000000010"]
    });

    expect(result).toEqual({
      companionId: "00000000-0000-0000-0000-000000000001",
      slotsCreated: 14
    });

    const [, slots] = rosterRepository.createRosterSlots.mock.calls[0] as [unknown, any[]];
    expect(slots).toHaveLength(14);

    for (const slot of slots) {
      expect(slot.startAt.getSeconds()).toBe(0);
      expect(slot.startAt.getMilliseconds()).toBe(0);
      expect(slot.startAt.getMinutes() % 30).toBe(0);
      expect(slot.endAt.getTime() - slot.startAt.getTime()).toBe(2 * 60 * 60 * 1000);
    }
  });
});

describe("rosterService.reserveSlots", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const { prisma } = requireMock("../../../shared/db/prisma");
    prisma.$transaction.mockImplementation(async (callback: jest.Mock) => {
      const tx = {};
      return callback(tx);
    });
  });

  test("rejects non-2-hour windows with VALIDATION_ERROR", async () => {
    const { prisma } = requireMock("../../../shared/db/prisma");

    await expect(
      rosterService.reserveSlots({
        venueId: "venue-1",
        startAt: "2026-04-26T10:00:00.000Z",
        endAt: "2026-04-26T11:30:00.000Z",
        bookingId: "booking-1"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR, statusCode: 400 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects startAt not aligned to 30-minute boundary with VALIDATION_ERROR", async () => {
    const { prisma } = requireMock("../../../shared/db/prisma");

    await expect(
      rosterService.reserveSlots({
        venueId: "venue-1",
        startAt: "2026-04-26T10:15:00.000Z",
        endAt: "2026-04-26T12:15:00.000Z",
        bookingId: "booking-1"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR, statusCode: 400 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("reserves CAPTAIN + VICE_CAPTAIN when window is valid", async () => {
    const { rosterRepository } = requireMock("../roster.repository");

    rosterRepository.lockOneSlotForDesignation
      .mockResolvedValueOnce([{ id: "slot-captain" }])
      .mockResolvedValueOnce([{ id: "slot-vice" }]);
    rosterRepository.bookSlotsForBooking.mockResolvedValue({ count: 2 });

    const result = await rosterService.reserveSlots({
      venueId: "venue-1",
      startAt: "2026-04-26T10:00:00.000Z",
      endAt: "2026-04-26T12:00:00.000Z",
      bookingId: "booking-1"
    });

    expect(rosterRepository.lockOneSlotForDesignation).toHaveBeenCalledTimes(2);
    expect(rosterRepository.bookSlotsForBooking).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ slotIds: ["slot-captain", "slot-vice"], bookingId: "booking-1" })
    );

    expect(result).toEqual({
      reserved: true,
      captainSlotId: "slot-captain",
      viceCaptainSlotId: "slot-vice"
    });
  });

  test("reserveSlotsWithDb allows caller-owned transactions", async () => {
    const { prisma } = requireMock("../../../shared/db/prisma");
    const { rosterRepository } = requireMock("../roster.repository");

    rosterRepository.lockOneSlotForDesignation
      .mockResolvedValueOnce([{ id: "slot-captain" }])
      .mockResolvedValueOnce([{ id: "slot-vice" }]);
    rosterRepository.bookSlotsForBooking.mockResolvedValue({ count: 2 });

    const startAt = new Date("2026-04-26T10:00:00.000Z");
    const endAt = new Date("2026-04-26T12:00:00.000Z");

    await rosterService.reserveSlotsWithDb({} as any, {
      venueId: "venue-1",
      startAt,
      endAt,
      bookingId: "booking-1"
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
