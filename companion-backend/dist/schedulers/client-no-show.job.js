"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runClientNoShow = runClientNoShow;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const constants_1 = require("../config/constants");
const logger_1 = require("../config/logger");
const utils_1 = require("../shared/utils");
const paymentService = __importStar(require("../services/payment.service"));
async function runClientNoShow() {
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            status: client_1.BookingStatus.CONFIRMED,
            duoStatus: client_1.DuoStatus.ACTIVATED,
            sessionStartedAt: null,
        },
    });
    const now = (0, utils_1.nowBusiness)();
    for (const booking of bookings) {
        const bookingDate = booking.date.toISOString().slice(0, 10);
        const startTime = (0, utils_1.buildBusinessDateTime)(bookingDate, booking.startTime);
        const noShowTime = startTime.add(constants_1.BUSINESS_RULES.CLIENT_NO_SHOW_MINUTES_AFTER_START, 'minute');
        if (now.isBefore(noShowTime)) {
            continue;
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    status: client_1.BookingStatus.COMPLETED,
                    clientNoShow: true,
                    sessionEndedAt: new Date(),
                    paymentHoldStatus: client_1.PaymentHoldStatus.CHARGED,
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
                    performedByType: client_1.ActorType.SYSTEM,
                    performedById: booking.clientId,
                },
            });
        });
        await paymentService.chargeHold(booking.id);
        logger_1.logger.warn({ bookingId: booking.id }, 'Client no-show auto-completed');
    }
}
