import { BookingStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { BUSINESS_RULES } from '../../config/constants';
import { NotFoundError, AppError } from '../../shared/errors';
import { buildBusinessDateTime, nowBusiness } from '../../shared/utils';

function isDetailRevealed(bookingDate: string, startTime: string) {
  const startDateTime = buildBusinessDateTime(bookingDate, startTime);
  const revealTime = startDateTime.subtract(BUSINESS_RULES.COMPANION_DETAIL_REVEAL_HOURS, 'hour');
  const now = nowBusiness();
  return now.isAfter(revealTime) || now.isSame(revealTime);
}

function isDuoRevealTime(bookingDate: string, startTime: string) {
  const startDateTime = buildBusinessDateTime(bookingDate, startTime);
  const revealTime = startDateTime.subtract(30, 'minute');
  const now = nowBusiness();
  return now.isAfter(revealTime) || now.isSame(revealTime);
}

export async function listCompanionBookings(companionId: string) {
  const today = nowBusiness().startOf('day').toDate();
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
      date: { gte: today },
      OR: [{ captainId: companionId }, { viceCaptainId: companionId }],
    },
    include: { venue: true, client: true },
    orderBy: { date: 'asc' },
  });

  return bookings.map((booking) => {
    const bookingDate = booking.date.toISOString().slice(0, 10);
    const revealed = isDetailRevealed(bookingDate, booking.startTime);
    return {
      bookingId: booking.id,
      date: bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      duoStatus: booking.duoStatus,
      isDetailRevealed: revealed,
      venue: revealed
        ? {
            id: booking.venue.id,
            name: booking.venue.name,
            type: booking.venue.type,
            address: booking.venue.address,
          }
        : null,
      clientNickname: revealed ? booking.clientNicknameSnapshot : null,
    };
  });
}

export async function getCompanionBooking(companionId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { venue: true, client: true, captain: true, viceCaptain: true },
  });

  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.captainId !== companionId && booking.viceCaptainId !== companionId) {
    throw new AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
  }

  const bookingDate = booking.date.toISOString().slice(0, 10);
  const revealDetails = isDetailRevealed(bookingDate, booking.startTime);
  const revealDuo = isDuoRevealTime(bookingDate, booking.startTime);

  const partnerCompanionName =
    booking.captainId === companionId
      ? booking.viceCaptain?.fullName
      : booking.captain?.fullName;

  return {
    bookingId: booking.id,
    date: bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    duoStatus: booking.duoStatus,
    venue: revealDetails
      ? {
          id: booking.venue.id,
          name: booking.venue.name,
          type: booking.venue.type,
          address: booking.venue.address,
        }
      : null,
    clientNickname: revealDetails ? booking.clientNicknameSnapshot : null,
    partnerCompanionName,
    duoQrCode: revealDuo ? booking.duoQrCode : null,
    duoPinCode: revealDuo ? booking.duoPinCode : null,
  };
}
