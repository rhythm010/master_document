"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocate = allocate;
const client_1 = require("@prisma/client");
const logger_1 = require("../config/logger");
const constants_1 = require("../config/constants");
const utils_1 = require("../shared/utils");
function shiftCoversSlot(startTime, endTime, shiftStart, shiftEnd) {
    const shiftStartMinutes = (0, utils_1.parseTimeToMinutes)(shiftStart);
    const shiftEndMinutes = (0, utils_1.parseTimeToMinutes)(shiftEnd);
    const { startMinutes, endMinutes } = (0, utils_1.getExpandedSlotWindow)(startTime, endTime);
    return shiftStartMinutes <= startMinutes && shiftEndMinutes >= endMinutes;
}
function overlaps(windowStart, windowEnd, bookingStart, bookingEnd) {
    return bookingStart < windowEnd && bookingEnd > windowStart;
}
async function fetchBookingsForCompanions(tx, companionIds, date) {
    if (companionIds.length === 0)
        return [];
    const now = new Date();
    return tx.booking.findMany({
        where: {
            date,
            AND: [
                {
                    OR: [
                        {
                            status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.ACTIVE] },
                        },
                        {
                            status: client_1.BookingStatus.PENDING,
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
async function getAvailableCandidates(tx, date, startTime, endTime, role, onlyCompanionId) {
    const shifts = await tx.shift.findMany({
        where: {
            date,
            status: { in: [client_1.ShiftStatus.SCHEDULED, client_1.ShiftStatus.ACTIVE] },
            companion: {
                role,
                isActive: true,
                backgroundVerified: true,
                penaltyStatus: { not: client_1.PenaltyStatus.PENALIZED },
                ...(onlyCompanionId ? { id: onlyCompanionId } : {}),
            },
        },
        include: {
            companion: true,
        },
    });
    const companionsInShift = shifts.filter((shift) => shiftCoversSlot(startTime, endTime, shift.startTime, shift.endTime));
    const companionIds = companionsInShift.map((shift) => shift.companionId);
    const bookings = await fetchBookingsForCompanions(tx, companionIds, date);
    const { startMinutes, endMinutes } = (0, utils_1.getExpandedSlotWindow)(startTime, endTime);
    const blocked = new Set();
    bookings.forEach((booking) => {
        const bookingStart = (0, utils_1.parseTimeToMinutes)(booking.startTime) - constants_1.BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
        const bookingEnd = (0, utils_1.parseTimeToMinutes)(booking.endTime) + constants_1.BUSINESS_RULES.REST_BUFFER_MINUTES;
        if (overlaps(startMinutes, endMinutes, bookingStart, bookingEnd)) {
            if (booking.captainId)
                blocked.add(booking.captainId);
            if (booking.viceCaptainId)
                blocked.add(booking.viceCaptainId);
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
async function allocate(request, tx) {
    const startTime = request.startTime;
    const endTime = request.endTime;
    const captainSpecified = Boolean(request.captainId);
    const viceSpecified = Boolean(request.viceCaptainId);
    let mode = client_1.AllocationMode.AUTO;
    if (captainSpecified && viceSpecified)
        mode = client_1.AllocationMode.BOTH_SPECIFIED;
    if (captainSpecified && !viceSpecified)
        mode = client_1.AllocationMode.CAPTAIN_SPECIFIED;
    if (!captainSpecified && viceSpecified)
        mode = client_1.AllocationMode.VICE_CAPTAIN_SPECIFIED;
    const availableCaptains = await getAvailableCandidates(tx, request.date, startTime, endTime, client_1.CompanionRole.CAPTAIN, request.captainId);
    const availableViceCaptains = await getAvailableCandidates(tx, request.date, startTime, endTime, client_1.CompanionRole.VICE_CAPTAIN, request.viceCaptainId);
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
    logger_1.logger.debug({
        captainId: selectedCaptain.companionId,
        viceCaptainId: selectedViceCaptain.companionId,
        mode,
    }, 'Allocation selection completed');
    return {
        captainId: selectedCaptain.companionId,
        viceCaptainId: selectedViceCaptain.companionId,
        captainShiftId: selectedCaptain.shiftId,
        viceCaptainShiftId: selectedViceCaptain.shiftId,
        mode,
    };
}
