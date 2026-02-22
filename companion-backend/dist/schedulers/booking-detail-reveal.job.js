"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBookingDetailReveal = runBookingDetailReveal;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const constants_1 = require("../config/constants");
const logger_1 = require("../config/logger");
const utils_1 = require("../shared/utils");
async function runBookingDetailReveal() {
    const bookings = await prisma_1.prisma.booking.findMany({
        where: { status: client_1.BookingStatus.CONFIRMED },
        select: { id: true, date: true, startTime: true },
    });
    const now = (0, utils_1.nowBusiness)();
    const due = bookings.filter((booking) => {
        const bookingDate = booking.date.toISOString().slice(0, 10);
        const startTime = (0, utils_1.buildBusinessDateTime)(bookingDate, booking.startTime);
        const revealTime = startTime.subtract(constants_1.BUSINESS_RULES.COMPANION_DETAIL_REVEAL_HOURS, 'hour');
        return now.isAfter(revealTime) || now.isSame(revealTime);
    });
    if (due.length > 0) {
        logger_1.logger.info({ count: due.length }, 'Booking detail reveal window reached');
    }
}
