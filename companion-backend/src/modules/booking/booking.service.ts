import {
  ActorType,
  BookingStatus,
  CancelledBy,
  PaymentHoldStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { BUSINESS_RULES, ALLOCATION_ENGINE_VERSION, PRICING_ENGINE_VERSION } from '../../config/constants';
import { logger } from '../../config/logger';
import { allocate } from '../../engines/allocation.engine';
import { calculatePrice } from '../../engines/pricing.engine';
import { calculateRefund } from '../../engines/refund.engine';
import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors';
import {
  buildBusinessDateTime,
  calculateEndTime,
  formatBusinessDate,
  generateNumericCode,
  generateQrCode,
  hoursUntil,
  isSlotWithinOperatingHours,
  nowBusiness,
  parseBusinessDate,
  withSerializableRetry,
} from '../../shared/utils';
import * as paymentService from '../../services/payment.service';
import { sendNotification } from '../../services/notification.service';

type BookingCreationResponse = {
  bookingId: string;
  status: BookingStatus;
  softLockExpiresAt: Date | null;
  pricing: {
    baseRate: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    serviceFee: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    currency: string;
  };
};

const idempotencyStore = new Map<
  string,
  { response: BookingCreationResponse; expiresAt: number }
>();
const idempotencyInFlight = new Map<string, Promise<BookingCreationResponse>>();

function getIdempotencyResponse(key?: string) {
  if (!key) return null;
  const entry = idempotencyStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    idempotencyStore.delete(key);
    return null;
  }
  return entry.response;
}

function setIdempotencyResponse(key: string | undefined, response: BookingCreationResponse) {
  if (!key) return;
  idempotencyStore.set(key, {
    response,
    expiresAt: Date.now() + BUSINESS_RULES.SOFT_LOCK_MINUTES * 60 * 1000,
  });
}

function ensureSlotValid(_date: string, startTime: string, operatingStart: string, operatingEnd: string) {
  const endTime = calculateEndTime(startTime, BUSINESS_RULES.SESSION_DURATION_MINUTES);
  if (!isSlotWithinOperatingHours(startTime, endTime, operatingStart, operatingEnd)) {
    throw new AppError(400, 'INVALID_SLOT', 'Time slot is outside operating hours');
  }
  return endTime;
}

function validateBookingWindow(date: string, startTime: string) {
  const hoursUntilStart = hoursUntil(date, startTime);
  if (hoursUntilStart < BUSINESS_RULES.BOOKING_MIN_LEAD_HOURS) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Date must be between 1 and 14 days from now.', [
      { field: 'date', message: 'Must be at least 24 hours in the future' },
    ]);
  }
  const maxHours = BUSINESS_RULES.BOOKING_MAX_ADVANCE_DAYS * 24;
  if (hoursUntilStart > maxHours) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Date must be between 1 and 14 days from now.', [
      { field: 'date', message: 'Must be within 14 days' },
    ]);
  }
}

export async function createBooking(
  clientId: string,
  payload: { venueId: string; date: string; startTime: string },
  context: { idempotencyKey?: string; deviceId?: string; clientLatitude?: number; clientLongitude?: number },
) {
  const idempotencyKey = context.idempotencyKey ? `${clientId}:${context.idempotencyKey}` : undefined;
  const cached = getIdempotencyResponse(idempotencyKey);
  if (cached) {
    return cached;
  }
  if (idempotencyKey) {
    const inFlight = idempotencyInFlight.get(idempotencyKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const bookingPromise = (async () => {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new NotFoundError('Client');
  }

  if (client.bookingStatusCache !== 'NONE') {
    throw new ConflictError(
      'ACTIVE_BOOKING_EXISTS',
      'You already have an active booking. Cancel it before creating a new one.',
      {
        currentBookingId: client.currentBookingId,
        currentBookingStatus: client.bookingStatusCache,
      },
    );
  }

  validateBookingWindow(payload.date, payload.startTime);

  const venue = await prisma.venue.findFirst({
    where: { id: payload.venueId, isActive: true },
  });

  if (!venue) {
    throw new NotFoundError('Venue');
  }

  const endTime = ensureSlotValid(
    payload.date,
    payload.startTime,
    venue.operatingHoursStart,
    venue.operatingHoursEnd,
  );

  const bookingDate = parseBusinessDate(payload.date).startOf('day').toDate();

  let result;
  try {
    result = await withSerializableRetry(async () => {
      return prisma.$transaction(
        async (tx) => {
          const freshClient = await tx.client.findUnique({ where: { id: clientId } });
          if (!freshClient) {
            throw new NotFoundError('Client');
          }
          if (freshClient.bookingStatusCache !== 'NONE') {
            throw new ConflictError(
              'ACTIVE_BOOKING_EXISTS',
              'You already have an active booking. Cancel it before creating a new one.',
              {
                currentBookingId: freshClient.currentBookingId,
                currentBookingStatus: freshClient.bookingStatusCache,
              },
            );
          }

          let allocation;
          try {
            allocation = await allocate(
              {
                venueId: venue.id,
                date: bookingDate,
                startTime: payload.startTime,
                endTime,
              },
              tx,
            );
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '';
            if (message === 'SLOT_UNAVAILABLE') {
              throw new ConflictError('SLOT_UNAVAILABLE', 'No companion duo is available for this slot.');
            }
            throw error;
          }

          const pricing = calculatePrice(venue.type);
          const softLockExpiresAt = new Date(Date.now() + BUSINESS_RULES.SOFT_LOCK_MINUTES * 60 * 1000);

          const booking = await tx.booking.create({
            data: {
              clientId,
              venueId: venue.id,
              captainId: allocation.captainId,
              viceCaptainId: allocation.viceCaptainId,
              allocationMode: allocation.mode,
              captainShiftId: allocation.captainShiftId,
              viceCaptainShiftId: allocation.viceCaptainShiftId,
              clientNicknameSnapshot: freshClient.nickname,
              duoStatus: 'PENDING',
              duoQrCode: generateQrCode(),
              duoPinCode: generateNumericCode(BUSINESS_RULES.DUO_PIN_LENGTH),
              qrCode: generateQrCode(),
              pinCode: generateNumericCode(BUSINESS_RULES.CLIENT_PIN_LENGTH),
              date: bookingDate,
              startTime: payload.startTime,
              endTime,
              durationMinutes: BUSINESS_RULES.SESSION_DURATION_MINUTES,
              status: BookingStatus.PENDING,
              baseRate: pricing.baseRate,
              vatAmount: pricing.vatAmount,
              serviceFee: pricing.serviceFee,
              grandTotal: pricing.grandTotal,
              paymentHoldStatus: PaymentHoldStatus.NONE,
              softLockExpiresAt,
            },
          });

          await tx.client.update({
            where: { id: clientId },
            data: {
              currentBookingId: booking.id,
              bookingStatusCache: 'PENDING',
            },
          });

          await tx.bookingAuditLog.create({
            data: {
              bookingId: booking.id,
              action: 'CREATED',
              performedByType: ActorType.CLIENT,
              performedById: clientId,
              deviceId: context.deviceId,
              pricingEngineVersion: PRICING_ENGINE_VERSION,
              allocationEngineVersion: ALLOCATION_ENGINE_VERSION,
              clientLatitude: context.clientLatitude,
              clientLongitude: context.clientLongitude,
            },
          });

          return {
            booking,
            pricing,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      throw error;
    }
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : '';
    if (code === '40001' || code === 'P2034' || message === 'SERIALIZATION_RETRY_EXCEEDED') {
      logger.warn({ err: error, clientId }, 'Booking allocation conflict detected');
      throw new ConflictError('SLOT_UNAVAILABLE', 'No companion duo is available for this slot.');
    }
    throw error;
  }

  try {
    await paymentService.holdAmount(result.pricing.grandTotal.toString());
  } catch (error: unknown) {
    logger.error({ err: error, bookingId: result.booking.id }, 'Payment hold failed');
    await failBooking(result.booking.id, 'Payment hold failed');
    throw error;
  }
  await confirmBooking(result.booking.id);

  const response = {
    bookingId: result.booking.id,
    status: result.booking.status,
    softLockExpiresAt: result.booking.softLockExpiresAt,
    pricing: {
      baseRate: result.pricing.baseRate,
      vatAmount: result.pricing.vatAmount,
      serviceFee: result.pricing.serviceFee,
      grandTotal: result.pricing.grandTotal,
      currency: result.pricing.currency,
    },
  };

  return response;
  })();

  if (idempotencyKey) {
    idempotencyInFlight.set(idempotencyKey, bookingPromise);
  }

  try {
    const response = await bookingPromise;
    setIdempotencyResponse(idempotencyKey, response);
    return response;
  } finally {
    if (idempotencyKey) {
      idempotencyInFlight.delete(idempotencyKey);
    }
  }
}

export async function confirmBooking(bookingId: string) {
  const now = new Date();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.status !== BookingStatus.PENDING) {
    return booking;
  }

  if (booking.softLockExpiresAt && booking.softLockExpiresAt < now) {
    await failBooking(bookingId, 'Soft-lock expired');
    return booking;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!fresh || fresh.status !== BookingStatus.PENDING) {
      return fresh;
    }

    const confirmed = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentHoldStatus: PaymentHoldStatus.HELD,
        paymentHoldAmount: fresh.grandTotal,
        softLockExpiresAt: null,
      },
    });

    await tx.client.update({
      where: { id: fresh.clientId },
      data: { bookingStatusCache: 'CONFIRMED' },
    });

    await tx.bookingAuditLog.create({
      data: {
        bookingId: fresh.id,
        action: 'CONFIRMED',
        performedByType: ActorType.SYSTEM,
        performedById: fresh.clientId,
      },
    });

    return confirmed;
  });

  if (updated) {
    await sendNotification({
      recipientType: ActorType.CLIENT,
      recipientId: updated.clientId,
      bookingId: updated.id,
      notificationType: 'BOOKING_CONFIRMED',
    });
  }

  return updated;
}

export async function failBooking(bookingId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.FAILED,
        failureReason: reason,
        paymentHoldStatus: PaymentHoldStatus.VOIDED,
      },
    });

    await tx.client.update({
      where: { id: booking.clientId },
      data: { currentBookingId: null, bookingStatusCache: 'NONE' },
    });

    await tx.bookingAuditLog.create({
      data: {
        bookingId,
        action: 'FAILED',
        performedByType: ActorType.SYSTEM,
        performedById: booking.clientId,
      },
    });
  });

  await paymentService.voidHold(bookingId);
}

export async function getBookingStatus(clientId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking');
  }
  if (booking.clientId !== clientId) {
    throw new AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
  }

  return {
    bookingId: booking.id,
    status: booking.status,
    duoStatus: booking.duoStatus,
    softLockExpiresAt: booking.softLockExpiresAt,
  };
}

export async function getBookingDetails(clientId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { venue: true },
  });

  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.clientId !== clientId) {
    throw new AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
  }

  const bookingDate = formatBusinessDate(booking.date);
  const startDateTime = buildBusinessDateTime(bookingDate, booking.startTime);
  const revealTime = startDateTime.subtract(30, 'minute');
  const now = nowBusiness();
  const shouldReveal =
    now.isSame(startDateTime, 'day') &&
    (now.isAfter(revealTime) || now.isSame(revealTime));

  return {
    bookingId: booking.id,
    status: booking.status,
    venue: {
      id: booking.venue.id,
      name: booking.venue.name,
      type: booking.venue.type,
      address: booking.venue.address,
    },
    date: bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    pricing: {
      baseRate: booking.baseRate,
      vatAmount: booking.vatAmount,
      serviceFee: booking.serviceFee,
      grandTotal: booking.grandTotal,
      currency: 'AED',
    },
    qrCode: shouldReveal ? booking.qrCode : null,
    pinCode: shouldReveal ? booking.pinCode : null,
    duoStatus: booking.duoStatus,
    createdAt: booking.createdAt,
  };
}

export async function cancelBooking(
  clientId: string,
  bookingId: string,
  reason?: string,
  cancelledBy: CancelledBy = CancelledBy.CLIENT,
  actorId?: string,
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.clientId !== clientId && cancelledBy === CancelledBy.CLIENT) {
    throw new AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
  }

  const cancellableStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
  if (!cancellableStatuses.includes(booking.status)) {
    throw new AppError(400, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled in its current state.');
  }

  const hoursUntilStart = hoursUntil(formatBusinessDate(booking.date), booking.startTime);
  const refund = calculateRefund(booking.grandTotal, hoursUntilStart);

  const refundPercentage = Number(refund.refundPercentage);
  const paymentHoldStatus = refundPercentage === 100 ? PaymentHoldStatus.VOIDED : PaymentHoldStatus.REFUNDED;

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy,
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundPercentage: refund.refundPercentage,
        refundAmount: refund.refundAmount,
        paymentHoldStatus,
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
        performedByType: cancelledBy === CancelledBy.CLIENT ? ActorType.CLIENT : ActorType.ADMIN,
        performedById: actorId ?? booking.clientId,
      },
    });

    return cancelled;
  });

  await paymentService.refund(booking.id, refund.refundAmount.toString());
  await sendNotification({
    recipientType: ActorType.CLIENT,
    recipientId: booking.clientId,
    bookingId: booking.id,
    notificationType: 'CANCELLATION',
  });

  return {
    bookingId: updated.id,
    status: updated.status,
    refundPercentage: refundPercentage,
    refundAmount: refund.refundAmount,
  };
}

export async function getCurrentBooking(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new NotFoundError('Client');
  }

  if (!client.currentBookingId) {
    return { hasActiveBooking: false, bookingId: null, status: null };
  }

  const booking = await prisma.booking.findUnique({ where: { id: client.currentBookingId } });
  const terminalStatuses: BookingStatus[] = [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.FAILED,
  ];
  if (!booking || terminalStatuses.includes(booking.status)) {
    await prisma.client.update({
      where: { id: client.id },
      data: { currentBookingId: null, bookingStatusCache: 'NONE' },
    });
    logger.warn({ clientId, bookingId: client.currentBookingId }, 'Client booking cache corrected');
    return { hasActiveBooking: false, bookingId: null, status: null };
  }

  return {
    hasActiveBooking: true,
    bookingId: booking.id,
    status: booking.status,
  };
}
