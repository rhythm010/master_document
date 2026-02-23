import {
  AllocationMode,
  BookingStatus,
  CompanionRole,
  PenaltyStatus,
  Prisma,
  PrismaClient,
  ShiftStatus,
} from '@prisma/client';
import { logger } from '../config/logger';
import { BUSINESS_RULES } from '../config/constants';
import {
  getExpandedSlotWindow,
  parseTimeToMinutes,
} from '../shared/utils';

export type AllocationRequest = {
  venueId: string;
  date: Date;
  startTime: string;
  endTime: string;
  captainId?: string;
  viceCaptainId?: string;
};

export type AllocationResult = {
  captainId: string;
  viceCaptainId: string;
  captainShiftId: string;
  viceCaptainShiftId: string;
  mode: AllocationMode;
};

type DbClient = Prisma.TransactionClient | PrismaClient;

type Candidate = {
  companionId: string;
  shiftId: string;
  totalSessions: number;
};

function shiftCoversSlot(startTime: string, endTime: string, shiftStart: string, shiftEnd: string) {
  const shiftStartMinutes = parseTimeToMinutes(shiftStart);
  const shiftEndMinutes = parseTimeToMinutes(shiftEnd);
  const { startMinutes, endMinutes } = getExpandedSlotWindow(startTime, endTime);
  return shiftStartMinutes <= startMinutes && shiftEndMinutes >= endMinutes;
}

function overlaps(windowStart: number, windowEnd: number, bookingStart: number, bookingEnd: number) {
  return bookingStart < windowEnd && bookingEnd > windowStart;
}

async function fetchBookingsForCompanions(
  tx: DbClient,
  companionIds: string[],
  date: Date,
) {
  if (companionIds.length === 0) return [];
  const now = new Date();
  return tx.booking.findMany({
    where: {
      date,
      AND: [
        {
          OR: [
            {
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
            },
            {
              status: BookingStatus.PENDING,
              softLockExpiresAt: { gt: now },
            },
          ],
        },
        {
          OR: [{ captainId: { in: companionIds } }, { viceCaptainId: { in: companionIds } }],
        },
      ],
    },
    select: {
      captainId: true,
      viceCaptainId: true,
      startTime: true,
      endTime: true,
    },
  });
}

async function getAvailableCandidates(
  tx: DbClient,
  date: Date,
  startTime: string,
  endTime: string,
  role: CompanionRole,
  onlyCompanionId?: string,
): Promise<Candidate[]> {
  const shifts = await tx.shift.findMany({
    where: {
      date,
      status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] },
      companion: {
        role,
        isActive: true,
        backgroundVerified: true,
        penaltyStatus: { not: PenaltyStatus.PENALIZED },
        ...(onlyCompanionId ? { id: onlyCompanionId } : {}),
      },
    },
    include: {
      companion: true,
    },
  });

  const companionsInShift = shifts.filter((shift) =>
    shiftCoversSlot(startTime, endTime, shift.startTime, shift.endTime),
  );

  const companionIds = companionsInShift.map((shift) => shift.companionId);
  const bookings = await fetchBookingsForCompanions(tx, companionIds, date);
  const { startMinutes, endMinutes } = getExpandedSlotWindow(startTime, endTime);

  const blocked = new Set<string>();
  bookings.forEach((booking) => {
    const bookingStart = parseTimeToMinutes(booking.startTime) - BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
    const bookingEnd = parseTimeToMinutes(booking.endTime) + BUSINESS_RULES.REST_BUFFER_MINUTES;
    if (overlaps(startMinutes, endMinutes, bookingStart, bookingEnd)) {
      if (booking.captainId) blocked.add(booking.captainId);
      if (booking.viceCaptainId) blocked.add(booking.viceCaptainId);
    }
  });

  return companionsInShift
    .filter((shift) => !blocked.has(shift.companionId))
    .map((shift) => ({
      companionId: shift.companionId,
      shiftId: shift.id,
      totalSessions: shift.companion.totalSessions,
    }));
}

export async function allocate(
  request: AllocationRequest,
  tx: DbClient,
): Promise<AllocationResult> {
  const startTime = request.startTime;
  const endTime = request.endTime;

  const captainSpecified = Boolean(request.captainId);
  const viceSpecified = Boolean(request.viceCaptainId);

  let mode: AllocationMode = AllocationMode.AUTO;
  if (captainSpecified && viceSpecified) mode = AllocationMode.BOTH_SPECIFIED;
  if (captainSpecified && !viceSpecified) mode = AllocationMode.CAPTAIN_SPECIFIED;
  if (!captainSpecified && viceSpecified) mode = AllocationMode.VICE_CAPTAIN_SPECIFIED;

  const availableCaptains = await getAvailableCandidates(
    tx,
    request.date,
    startTime,
    endTime,
    CompanionRole.CAPTAIN,
    request.captainId,
  );

  const availableViceCaptains = await getAvailableCandidates(
    tx,
    request.date,
    startTime,
    endTime,
    CompanionRole.VICE_CAPTAIN,
    request.viceCaptainId,
  );

  if (availableCaptains.length === 0) {
    throw new Error(captainSpecified ? 'COMPANION_UNAVAILABLE' : 'SLOT_UNAVAILABLE');
  }

  if (availableViceCaptains.length === 0) {
    throw new Error(viceSpecified ? 'COMPANION_UNAVAILABLE' : 'SLOT_UNAVAILABLE');
  }

  availableCaptains.sort((a, b) => a.totalSessions - b.totalSessions);
  availableViceCaptains.sort((a, b) => a.totalSessions - b.totalSessions);

  const selectedCaptain = availableCaptains[0];
  const selectedViceCaptain = availableViceCaptains[0];

  logger.debug(
    {
      captainId: selectedCaptain.companionId,
      viceCaptainId: selectedViceCaptain.companionId,
      mode,
    },
    'Allocation selection completed',
  );

  return {
    captainId: selectedCaptain.companionId,
    viceCaptainId: selectedViceCaptain.companionId,
    captainShiftId: selectedCaptain.shiftId,
    viceCaptainShiftId: selectedViceCaptain.shiftId,
    mode,
  };
}
