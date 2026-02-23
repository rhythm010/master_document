import { BookingStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BUSINESS_RULES } from '../config/constants';
import { logger } from '../config/logger';
import { buildBusinessDateTime, nowBusiness } from '../shared/utils';

export async function runBookingDetailReveal() {
  const bookings = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED },
    select: { id: true, date: true, startTime: true },
  });

  const now = nowBusiness();
  const due = bookings.filter((booking) => {
    const bookingDate = booking.date.toISOString().slice(0, 10);
    const startTime = buildBusinessDateTime(bookingDate, booking.startTime);
    const revealTime = startTime.subtract(BUSINESS_RULES.COMPANION_DETAIL_REVEAL_HOURS, 'hour');
    return now.isAfter(revealTime) || now.isSame(revealTime);
  });

  if (due.length > 0) {
    logger.info({ count: due.length }, 'Booking detail reveal window reached');
  }
}
