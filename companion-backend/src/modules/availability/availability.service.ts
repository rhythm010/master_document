import {
  BookingStatus,
  CompanionRole,
  PenaltyStatus,
  ShiftStatus,
  VenueType,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { BUSINESS_RULES } from '../../config/constants';
import { calculatePrice } from '../../engines/pricing.engine';
import { NotFoundError, AppError } from '../../shared/errors';
import {
  generateSlots,
  getExpandedSlotWindow,
  isDateWithinBookingWindow,
  parseBusinessDate,
  parseTimeToMinutes,
} from '../../shared/utils';

export async function getAvailability(venueId: string, date: string) {
  if (!isDateWithinBookingWindow(date)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Date must be between 1 and 14 days from now.', [
      { field: 'date', message: 'Must be at least 24 hours in the future' },
    ]);
  }

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true },
  });

  if (!venue) {
    throw new NotFoundError('Venue');
  }

  const slots = generateSlots(
    venue.operatingHoursStart,
    venue.operatingHoursEnd,
    BUSINESS_RULES.SESSION_DURATION_MINUTES,
  );

  const shiftDate = parseBusinessDate(date).startOf('day').toDate();

  const shifts = await prisma.shift.findMany({
    where: {
      date: shiftDate,
      status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] },
      companion: {
        isActive: true,
        backgroundVerified: true,
        penaltyStatus: { not: PenaltyStatus.PENALIZED },
      },
    },
    include: { companion: true },
  });

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      date: shiftDate,
      OR: [
        { status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] } },
        { status: BookingStatus.PENDING, softLockExpiresAt: { gt: now } },
      ],
    },
    select: {
      captainId: true,
      viceCaptainId: true,
      startTime: true,
      endTime: true,
    },
  });

  const results = slots.map((slot) => {
    const { startMinutes, endMinutes } = getExpandedSlotWindow(slot.startTime, slot.endTime);

    const eligibleShifts = shifts.filter((shift) => {
      const shiftStart = parseTimeToMinutes(shift.startTime);
      const shiftEnd = parseTimeToMinutes(shift.endTime);
      return shiftStart <= startMinutes && shiftEnd >= endMinutes;
    });

    const blocked = new Set<string>();
    bookings.forEach((booking) => {
      const bookingStart =
        parseTimeToMinutes(booking.startTime) - BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
      const bookingEnd =
        parseTimeToMinutes(booking.endTime) + BUSINESS_RULES.REST_BUFFER_MINUTES;
      if (bookingStart < endMinutes && bookingEnd > startMinutes) {
        if (booking.captainId) blocked.add(booking.captainId);
        if (booking.viceCaptainId) blocked.add(booking.viceCaptainId);
      }
    });

    const availableCaptains = eligibleShifts.filter(
      (shift) => shift.companion.role === CompanionRole.CAPTAIN && !blocked.has(shift.companionId),
    );
    const availableViceCaptains = eligibleShifts.filter(
      (shift) =>
        shift.companion.role === CompanionRole.VICE_CAPTAIN && !blocked.has(shift.companionId),
    );

    const available = availableCaptains.length > 0 && availableViceCaptains.length > 0;
    const pricing = available ? calculatePrice(venue.type as VenueType) : null;

    return {
      startTime: slot.startTime,
      endTime: slot.endTime,
      available,
      pricing: pricing
        ? {
            baseRate: pricing.baseRate,
            vatAmount: pricing.vatAmount,
            serviceFee: pricing.serviceFee,
            grandTotal: pricing.grandTotal,
            currency: pricing.currency,
          }
        : null,
    };
  });

  return {
    venueId: venue.id,
    date,
    slots: results,
  };
}
