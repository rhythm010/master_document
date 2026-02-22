import { ActorType, BookingStatus, DuoStatus, PaymentHoldStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BUSINESS_RULES } from '../config/constants';
import { logger } from '../config/logger';
import { buildBusinessDateTime, formatBusinessDate, nowBusiness } from '../shared/utils';
import * as paymentService from '../services/payment.service';

export async function runClientNoShow() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      duoStatus: DuoStatus.ACTIVATED,
      sessionStartedAt: null,
    },
  });

  const now = nowBusiness();
  for (const booking of bookings) {
    const bookingDate = formatBusinessDate(booking.date);
    const startTime = buildBusinessDateTime(bookingDate, booking.startTime);
    const noShowTime = startTime.add(BUSINESS_RULES.CLIENT_NO_SHOW_MINUTES_AFTER_START, 'minute');
    if (now.isBefore(noShowTime)) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.COMPLETED,
          clientNoShow: true,
          sessionEndedAt: new Date(),
          paymentHoldStatus: PaymentHoldStatus.CHARGED,
        },
      });

      await tx.client.update({
        where: { id: booking.clientId },
        data: { currentBookingId: null, bookingStatusCache: 'NONE' },
      });

      if (booking.captainId) {
        await tx.companion.update({
          where: { id: booking.captainId },
          data: { totalSessions: { increment: 1 } },
        });
      }

      if (booking.viceCaptainId) {
        await tx.companion.update({
          where: { id: booking.viceCaptainId },
          data: { totalSessions: { increment: 1 } },
        });
      }

      await tx.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'AUTO_COMPLETED_NO_SHOW',
          performedByType: ActorType.SYSTEM,
          performedById: booking.clientId,
        },
      });
    });

    await paymentService.chargeHold(booking.id);
    logger.warn({ bookingId: booking.id }, 'Client no-show auto-completed');
  }
}
