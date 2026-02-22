import { ActorType, BookingStatus, CancelledBy, DuoStatus, PaymentHoldStatus, PenaltyIssuer, PenaltySeverity, PenaltyType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BUSINESS_RULES } from '../config/constants';
import { logger } from '../config/logger';
import { buildBusinessDateTime, formatBusinessDate, nowBusiness } from '../shared/utils';
import * as paymentService from '../services/payment.service';
import { sendNotification } from '../services/notification.service';

export async function runDuoBreach() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      duoStatus: { not: DuoStatus.ACTIVATED },
    },
  });

  const now = nowBusiness();
  for (const booking of bookings) {
    const bookingDate = formatBusinessDate(booking.date);
    const startTime = buildBusinessDateTime(bookingDate, booking.startTime);
    const breachTime = startTime.subtract(BUSINESS_RULES.DUO_BREACH_MINUTES_BEFORE_START, 'minute');
    if (now.isBefore(breachTime)) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledBy: CancelledBy.SYSTEM,
          cancelledAt: new Date(),
          duoStatus: DuoStatus.BREACH,
          refundPercentage: 100,
          refundAmount: booking.grandTotal,
          paymentHoldStatus: PaymentHoldStatus.REFUNDED,
        },
      });

      await tx.client.update({
        where: { id: booking.clientId },
        data: { currentBookingId: null, bookingStatusCache: 'NONE' },
      });

      const penaltyPayload = {
        type: PenaltyType.BREACH,
        reason: 'Duo breach',
        severity: PenaltySeverity.HIGH,
        issuedBy: PenaltyIssuer.SYSTEM,
      };

      if (booking.captainId) {
        await tx.penalty.create({
          data: {
            companionId: booking.captainId,
            bookingId: booking.id,
            ...penaltyPayload,
          },
        });
      }

      if (booking.viceCaptainId) {
        await tx.penalty.create({
          data: {
            companionId: booking.viceCaptainId,
            bookingId: booking.id,
            ...penaltyPayload,
          },
        });
      }

      await tx.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'AUTO_CANCELLED_BREACH',
          performedByType: ActorType.SYSTEM,
          performedById: booking.clientId,
        },
      });
    });

    await paymentService.refund(booking.id, booking.grandTotal.toString());
    await sendNotification({
      recipientType: ActorType.CLIENT,
      recipientId: booking.clientId,
      bookingId: booking.id,
      notificationType: 'CANCELLATION',
    });
    logger.warn({ bookingId: booking.id }, 'Duo breach auto-cancelled');
  }
}
