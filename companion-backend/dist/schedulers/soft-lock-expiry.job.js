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
exports.runSoftLockExpiry = runSoftLockExpiry;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const logger_1 = require("../config/logger");
const paymentService = __importStar(require("../services/payment.service"));
async function runSoftLockExpiry() {
    const now = new Date();
    const expired = await prisma_1.prisma.booking.findMany({
        where: {
            status: client_1.BookingStatus.PENDING,
            softLockExpiresAt: { lt: now },
        },
    });
    for (const booking of expired) {
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    status: client_1.BookingStatus.FAILED,
                    failureReason: 'Soft-lock expired',
                    paymentHoldStatus: client_1.PaymentHoldStatus.VOIDED,
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
                    performedByType: client_1.ActorType.SYSTEM,
                    performedById: booking.clientId,
                },
            });
        });
        await paymentService.voidHold(booking.id);
        logger_1.logger.warn({ bookingId: booking.id }, 'Soft-lock expired');
    }
}
