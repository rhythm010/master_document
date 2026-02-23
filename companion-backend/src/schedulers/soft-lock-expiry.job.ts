import { BookingStatus, ActorType, PaymentHoldStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import * as paymentService from '../services/payment.service';

export async function runSoftLockExpiry() {
  const now = new Date();
  const expired = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      softLockExpiresAt: { lt: now },
    },
  });

  for (const booking of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.FAILED,
          failureReason: 'Soft-lock expired',
          paymentHoldStatus: PaymentHoldStatus.VOIDED,
        },
      });

      await tx.client.update({
        where: { id: booking.clientId },
        data: { currentBookingId: null, bookingStatusCache: 'NONE' },
      });

      await tx.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'FAILED',
          performedByType: ActorType.SYSTEM,
          performedById: booking.clientId,
        },
      });
    });

    await paymentService.voidHold(booking.id);
    logger.warn({ bookingId: booking.id }, 'Soft-lock expired');
  }
}
