"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCompanionBookings = listCompanionBookings;
exports.getCompanionBooking = getCompanionBooking;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const constants_1 = require("../../config/constants");
const errors_1 = require("../../shared/errors");
const utils_1 = require("../../shared/utils");
function isDetailRevealed(bookingDate, startTime) {
    const startDateTime = (0, utils_1.buildBusinessDateTime)(bookingDate, startTime);
    const revealTime = startDateTime.subtract(constants_1.BUSINESS_RULES.COMPANION_DETAIL_REVEAL_HOURS, 'hour');
    const now = (0, utils_1.nowBusiness)();
    return now.isAfter(revealTime) || now.isSame(revealTime);
}
function isDuoRevealTime(bookingDate, startTime) {
    const startDateTime = (0, utils_1.buildBusinessDateTime)(bookingDate, startTime);
    const revealTime = startDateTime.subtract(30, 'minute');
    const now = (0, utils_1.nowBusiness)();
    return now.isAfter(revealTime) || now.isSame(revealTime);
}
async function listCompanionBookings(companionId) {
    const today = (0, utils_1.nowBusiness)().startOf('day').toDate();
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.ACTIVE] },
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
async function getCompanionBooking(companionId, bookingId) {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { venue: true, client: true, captain: true, viceCaptain: true },
    });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    if (booking.captainId !== companionId && booking.viceCaptainId !== companionId) {
        throw new errors_1.AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
    }
    const bookingDate = booking.date.toISOString().slice(0, 10);
    const revealDetails = isDetailRevealed(bookingDate, booking.startTime);
    const revealDuo = isDuoRevealTime(bookingDate, booking.startTime);
    const partnerCompanionName = booking.captainId === companionId
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
