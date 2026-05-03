import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";

import { sessionInProgressService } from "../session-in-progress.service";
import { ErrorCodes } from "../../../shared/errors/errorCodes";

const requireMock = (moduleName: string) => jest.requireMock(moduleName) as any;

jest.mock("../../../shared/db/prisma", () => ({
  prisma: {
    $transaction: jest.fn()
  }
}));

jest.mock("../../booking/booking.repository", () => ({
  bookingRepository: {
    lockBookingById: jest.fn()
  }
}));

jest.mock("../session-in-progress.repository", () => ({
  sessionInProgressRepository: {
    findBookingAuthContext: jest.fn(),
    listBookingMessages: jest.fn(),
    findCompanionAssignmentForBooking: jest.fn(),
    createBookingMessage: jest.fn(),
    lockBookingForExtension: jest.fn(),
    findBookingSessionContext: jest.fn()
  }
}));

describe("sessionInProgressService", () => {
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

  test("listBookingMessages forbids non captain/vice companions", async () => {
    const { sessionInProgressRepository } = requireMock("../session-in-progress.repository");

    sessionInProgressRepository.findBookingAuthContext.mockResolvedValue({
      id: "booking-1",
      status: "ACTIVE",
      clientId: "client-1",
      assignments: [{ companionId: "companion-1", designation: "OBSERVER" as any }]
    });

    await expect(
      sessionInProgressService.listBookingMessages({ bookingId: "booking-1", companionId: "companion-1" })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });
  });

  test("createBookingMessage forbids non captain/vice companions", async () => {
    const { bookingRepository } = requireMock("../../booking/booking.repository");
    const { sessionInProgressRepository } = requireMock("../session-in-progress.repository");

    bookingRepository.lockBookingById.mockResolvedValue([{ id: "booking-1", status: "ACTIVE", clientId: "client-1" }]);

    sessionInProgressRepository.findCompanionAssignmentForBooking.mockResolvedValue({ designation: "OBSERVER" as any });

    await expect(
      sessionInProgressService.createBookingMessage({
        bookingId: "booking-1",
        companionId: "companion-1",
        content: "hi"
      })
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });

    expect(sessionInProgressRepository.createBookingMessage).not.toHaveBeenCalled();
  });
});
