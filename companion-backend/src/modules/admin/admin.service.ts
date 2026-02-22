import {
  AllocationMode,
  ActorType,
  BookingStatus,
  CancelledBy,
  CompanionRole,
  PaymentHoldStatus,
  PenaltyStatus,
  ShiftStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { BUSINESS_RULES, ALLOCATION_ENGINE_VERSION, PRICING_ENGINE_VERSION } from '../../config/constants';
import { allocate } from '../../engines/allocation.engine';
import { calculatePrice } from '../../engines/pricing.engine';
import { ConflictError, NotFoundError, AppError } from '../../shared/errors';
import {
  calculateEndTime,
  generateNumericCode,
  generateQrCode,
  isSlotWithinOperatingHours,
  parseBusinessDate,
  parseTimeToMinutes,
} from '../../shared/utils';
import * as paymentService from '../../services/payment.service';
import { sendNotification } from '../../services/notification.service';

function determineMode(captainId?: string | null, viceCaptainId?: string | null) {
  if (captainId && viceCaptainId) return AllocationMode.BOTH_SPECIFIED;
  if (captainId) return AllocationMode.CAPTAIN_SPECIFIED;
  if (viceCaptainId) return AllocationMode.VICE_CAPTAIN_SPECIFIED;
  return AllocationMode.AUTO;
}

async function ensureCompanionActive(companionId: string, role: CompanionRole) {
  const companion = await prisma.companion.findFirst({
    where: {
      id: companionId,
      role,
      isActive: true,
      backgroundVerified: true,
      penaltyStatus: { not: PenaltyStatus.PENALIZED },
    },
  });

  if (!companion) {
    throw new ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
  }
}

async function findShiftId(companionId: string, date: Date) {
  const shift = await prisma.shift.findFirst({
    where: {
      date,
      status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] },
      companionId,
    },
  });
  return shift?.id ?? null;
}

async function assertCompanionAvailable(
  companionId: string,
  role: CompanionRole,
  date: Date,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
) {
  const shift = await prisma.shift.findFirst({
    where: {
      date,
      status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] },
      companion: {
        id: companionId,
        role,
        isActive: true,
        backgroundVerified: true,
        penaltyStatus: { not: PenaltyStatus.PENALIZED },
      },
    },
    include: { companion: true },
  });

  if (!shift) {
    throw new ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
  }

  const startMinutes = parseTimeToMinutes(startTime) - BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
  const endMinutes = parseTimeToMinutes(endTime) + BUSINESS_RULES.REST_BUFFER_MINUTES;
  const shiftStart = parseTimeToMinutes(shift.startTime);
  const shiftEnd = parseTimeToMinutes(shift.endTime);
  if (shiftStart > startMinutes || shiftEnd < endMinutes) {
    throw new ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
  }

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      date,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      AND: [
        {
          OR: [
            { status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] } },
            { status: BookingStatus.PENDING, softLockExpiresAt: { gt: now } },
          ],
        },
        { OR: [{ captainId: companionId }, { viceCaptainId: companionId }] },
      ],
    },
  });

  const overlaps = bookings.some((booking) => {
    const bookingStart =
      parseTimeToMinutes(booking.startTime) - BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
    const bookingEnd =
      parseTimeToMinutes(booking.endTime) + BUSINESS_RULES.REST_BUFFER_MINUTES;
    return bookingStart < endMinutes && bookingEnd > startMinutes;
  });

  if (overlaps) {
    throw new ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
  }

  return shift.id;
}

export async function createAdminBooking(
  adminId: string,
  payload: {
    clientId: string;
    venueId: string;
    date: string;
    startTime: string;
    captainId?: string | null;
    viceCaptainId?: string | null;
  },
) {
  const client = await prisma.client.findUnique({ where: { id: payload.clientId } });
  if (!client) {
    throw new NotFoundError('Client');
  }

  if (client.bookingStatusCache !== 'NONE') {
    throw new ConflictError('ACTIVE_BOOKING_EXISTS', 'Client already has an active booking.');
  }

  const venue = await prisma.venue.findFirst({ where: { id: payload.venueId, isActive: true } });
  if (!venue) {
    throw new NotFoundError('Venue');
  }

  const endTime = calculateEndTime(payload.startTime, BUSINESS_RULES.SESSION_DURATION_MINUTES);
  if (!isSlotWithinOperatingHours(payload.startTime, endTime, venue.operatingHoursStart, venue.operatingHoursEnd)) {
    throw new AppError(400, 'INVALID_SLOT', 'Time slot is outside operating hours');
  }

  const bookingDate = parseBusinessDate(payload.date).startOf('day').toDate();

  try {
    const allocationMode = determineMode(payload.captainId, payload.viceCaptainId);
    let captainId: string | null = null;
    let viceCaptainId: string | null = null;
    let captainShiftId: string | null = null;
    let viceCaptainShiftId: string | null = null;

    if (payload.captainId && !payload.viceCaptainId) {
      await ensureCompanionActive(payload.captainId, CompanionRole.CAPTAIN);
      const autoAllocation = await allocate(
        {
          venueId: venue.id,
          date: bookingDate,
          startTime: payload.startTime,
          endTime,
        },
        prisma,
      );
      captainId = payload.captainId;
      viceCaptainId = autoAllocation.viceCaptainId;
      captainShiftId = await findShiftId(payload.captainId, bookingDate);
      viceCaptainShiftId = autoAllocation.viceCaptainShiftId;
    } else if (!payload.captainId && payload.viceCaptainId) {
      await ensureCompanionActive(payload.viceCaptainId, CompanionRole.VICE_CAPTAIN);
      const autoAllocation = await allocate(
        {
          venueId: venue.id,
          date: bookingDate,
          startTime: payload.startTime,
          endTime,
        },
        prisma,
      );
      captainId = autoAllocation.captainId;
      viceCaptainId = payload.viceCaptainId;
      captainShiftId = autoAllocation.captainShiftId;
      viceCaptainShiftId = await findShiftId(payload.viceCaptainId, bookingDate);
    } else {
      const allocation = await allocate(
        {
          venueId: venue.id,
          date: bookingDate,
          startTime: payload.startTime,
          endTime,
          captainId: payload.captainId ?? undefined,
          viceCaptainId: payload.viceCaptainId ?? undefined,
        },
        prisma,
      );
      captainId = allocation.captainId;
      viceCaptainId = allocation.viceCaptainId;
      captainShiftId = allocation.captainShiftId;
      viceCaptainShiftId = allocation.viceCaptainShiftId;
    }

    if (!captainId || !viceCaptainId) {
      throw new ConflictError('SLOT_UNAVAILABLE', 'Specified companion is not available.');
    }

    const pricing = calculatePrice(venue.type);
    const booking = await prisma.booking.create({
      data: {
        clientId: payload.clientId,
        venueId: venue.id,
        captainId,
        viceCaptainId,
        allocationMode,
        captainShiftId: captainShiftId ?? undefined,
        viceCaptainShiftId: viceCaptainShiftId ?? undefined,
        clientNicknameSnapshot: client.nickname,
        duoStatus: 'PENDING',
        duoQrCode: generateQrCode(),
        duoPinCode: generateNumericCode(BUSINESS_RULES.DUO_PIN_LENGTH),
        qrCode: generateQrCode(),
        pinCode: generateNumericCode(BUSINESS_RULES.CLIENT_PIN_LENGTH),
        date: bookingDate,
        startTime: payload.startTime,
        endTime,
        durationMinutes: BUSINESS_RULES.SESSION_DURATION_MINUTES,
        status: BookingStatus.CONFIRMED,
        baseRate: pricing.baseRate,
        vatAmount: pricing.vatAmount,
        serviceFee: pricing.serviceFee,
        grandTotal: pricing.grandTotal,
        paymentHoldStatus: PaymentHoldStatus.HELD,
        paymentHoldAmount: pricing.grandTotal,
      },
    });

    await prisma.client.update({
      where: { id: client.id },
      data: { currentBookingId: booking.id, bookingStatusCache: 'CONFIRMED' },
    });

    await prisma.bookingAuditLog.create({
      data: {
        bookingId: booking.id,
        action: 'CREATED',
        performedByType: ActorType.ADMIN,
        performedById: adminId,
        pricingEngineVersion: PRICING_ENGINE_VERSION,
        allocationEngineVersion: ALLOCATION_ENGINE_VERSION,
      },
    });

    return { booking, pricing };
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : '';
    const code = message === 'COMPANION_UNAVAILABLE' ? 'COMPANION_UNAVAILABLE' : 'SLOT_UNAVAILABLE';
    throw new ConflictError(code, 'Specified companion is not available.');
  }
}

export async function cancelAdminBooking(adminId: string, bookingId: string, reason?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking');
  }

  const cancellableStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new AppError(400, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled in its current state.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy: CancelledBy.ADMIN,
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundPercentage: 100,
        refundAmount: booking.grandTotal,
        paymentHoldStatus: PaymentHoldStatus.REFUNDED,
      },
    });

    await tx.client.update({
      where: { id: booking.clientId },
      data: { currentBookingId: null, bookingStatusCache: 'NONE' },
    });

    await tx.bookingAuditLog.create({
      data: {
        bookingId,
        action: 'CANCELLED',
        performedByType: ActorType.ADMIN,
        performedById: adminId,
      },
    });

    return cancelled;
  });

  await paymentService.refund(booking.id, booking.grandTotal.toString());
  await sendNotification({
    recipientType: ActorType.CLIENT,
    recipientId: booking.clientId,
    bookingId: booking.id,
    notificationType: 'CANCELLATION',
  });

  return updated;
}

export async function reassignBooking(
  adminId: string,
  bookingId: string,
  payload: { captainId?: string | null; viceCaptainId?: string | null },
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new AppError(400, 'BOOKING_NOT_CANCELLABLE', 'Booking must be confirmed to reassign.');
  }

  if (!payload.captainId && !payload.viceCaptainId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one companion must be provided.');
  }

  const newCaptainId = payload.captainId ?? booking.captainId;
  const newViceCaptainId = payload.viceCaptainId ?? booking.viceCaptainId;

  if (!newCaptainId || !newViceCaptainId) {
    throw new ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
  }

  const captainShiftId = payload.captainId
    ? await assertCompanionAvailable(
        newCaptainId,
        CompanionRole.CAPTAIN,
        booking.date,
        booking.startTime,
        booking.endTime,
        booking.id,
      )
    : booking.captainShiftId;

  const viceShiftId = payload.viceCaptainId
    ? await assertCompanionAvailable(
        newViceCaptainId,
        CompanionRole.VICE_CAPTAIN,
        booking.date,
        booking.startTime,
        booking.endTime,
        booking.id,
      )
    : booking.viceCaptainShiftId;

  const allocationMode = determineMode(payload.captainId ?? undefined, payload.viceCaptainId ?? undefined);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        captainId: newCaptainId,
        viceCaptainId: newViceCaptainId,
        captainShiftId: captainShiftId ?? undefined,
        viceCaptainShiftId: viceShiftId ?? undefined,
        allocationMode,
        duoStatus: 'PENDING',
        duoQrCode: generateQrCode(),
        duoPinCode: generateNumericCode(BUSINESS_RULES.DUO_PIN_LENGTH),
      },
    });

    await tx.bookingAuditLog.create({
      data: {
        bookingId,
        action: 'REALLOCATED',
        performedByType: ActorType.ADMIN,
        performedById: adminId,
        metadata: {
          oldCaptainId: booking.captainId,
          oldViceCaptainId: booking.viceCaptainId,
          newCaptainId,
          newViceCaptainId,
        },
      },
    });

    return updatedBooking;
  });

  return updated;
}
