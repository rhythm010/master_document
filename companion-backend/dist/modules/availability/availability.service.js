"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailability = getAvailability;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const constants_1 = require("../../config/constants");
const pricing_engine_1 = require("../../engines/pricing.engine");
const errors_1 = require("../../shared/errors");
const utils_1 = require("../../shared/utils");
async function getAvailability(venueId, date) {
    if (!(0, utils_1.isDateWithinBookingWindow)(date)) {
        throw new errors_1.AppError(400, 'VALIDATION_ERROR', 'Date must be between 1 and 14 days from now.', [
            { field: 'date', message: 'Must be at least 24 hours in the future' },
        ]);
    }
    const venue = await prisma_1.prisma.venue.findFirst({
        where: { id: venueId, isActive: true },
    });
    if (!venue) {
        throw new errors_1.NotFoundError('Venue');
    }
    const slots = (0, utils_1.generateSlots)(venue.operatingHoursStart, venue.operatingHoursEnd, constants_1.BUSINESS_RULES.SESSION_DURATION_MINUTES);
    const shiftDate = (0, utils_1.parseBusinessDate)(date).startOf('day').toDate();
    const shifts = await prisma_1.prisma.shift.findMany({
        where: {
            date: shiftDate,
            status: { in: [client_1.ShiftStatus.SCHEDULED, client_1.ShiftStatus.ACTIVE] },
            companion: {
                isActive: true,
                backgroundVerified: true,
                penaltyStatus: { not: client_1.PenaltyStatus.PENALIZED },
            },
        },
        include: { companion: true },
    });
    const now = new Date();
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            date: shiftDate,
            OR: [
                { status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.ACTIVE] } },
                { status: client_1.BookingStatus.PENDING, softLockExpiresAt: { gt: now } },
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
        const { startMinutes, endMinutes } = (0, utils_1.getExpandedSlotWindow)(slot.startTime, slot.endTime);
        const eligibleShifts = shifts.filter((shift) => {
            const shiftStart = (0, utils_1.parseTimeToMinutes)(shift.startTime);
            const shiftEnd = (0, utils_1.parseTimeToMinutes)(shift.endTime);
            return shiftStart <= startMinutes && shiftEnd >= endMinutes;
        });
        const blocked = new Set();
        bookings.forEach((booking) => {
            const bookingStart = (0, utils_1.parseTimeToMinutes)(booking.startTime) - constants_1.BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
            const bookingEnd = (0, utils_1.parseTimeToMinutes)(booking.endTime) + constants_1.BUSINESS_RULES.REST_BUFFER_MINUTES;
            if (bookingStart < endMinutes && bookingEnd > startMinutes) {
                if (booking.captainId)
                    blocked.add(booking.captainId);
                if (booking.viceCaptainId)
                    blocked.add(booking.viceCaptainId);
            }
        });
        const availableCaptains = eligibleShifts.filter((shift) => shift.companion.role === client_1.CompanionRole.CAPTAIN && !blocked.has(shift.companionId));
        const availableViceCaptains = eligibleShifts.filter((shift) => shift.companion.role === client_1.CompanionRole.VICE_CAPTAIN && !blocked.has(shift.companionId));
        const available = availableCaptains.length > 0 && availableViceCaptains.length > 0;
        const pricing = available ? (0, pricing_engine_1.calculatePrice)(venue.type) : null;
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
