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
exports.createBooking = createBooking;
exports.confirmBooking = confirmBooking;
exports.failBooking = failBooking;
exports.getBookingStatus = getBookingStatus;
exports.getBookingDetails = getBookingDetails;
exports.cancelBooking = cancelBooking;
exports.getCurrentBooking = getCurrentBooking;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const constants_1 = require("../../config/constants");
const logger_1 = require("../../config/logger");
const allocation_engine_1 = require("../../engines/allocation.engine");
const pricing_engine_1 = require("../../engines/pricing.engine");
const refund_engine_1 = require("../../engines/refund.engine");
const errors_1 = require("../../shared/errors");
const utils_1 = require("../../shared/utils");
const paymentService = __importStar(require("../../services/payment.service"));
const notification_service_1 = require("../../services/notification.service");
const idempotencyStore = new Map();
function getIdempotencyResponse(key) {
    if (!key)
        return null;
    const entry = idempotencyStore.get(key);
    if (!entry)
        return null;
    if (entry.expiresAt < Date.now()) {
        idempotencyStore.delete(key);
        return null;
    }
    return entry.response;
}
function setIdempotencyResponse(key, response) {
    if (!key)
        return;
    idempotencyStore.set(key, {
        response,
        expiresAt: Date.now() + constants_1.BUSINESS_RULES.SOFT_LOCK_MINUTES * 60 * 1000,
    });
}
function ensureSlotValid(_date, startTime, operatingStart, operatingEnd) {
    const endTime = (0, utils_1.calculateEndTime)(startTime, constants_1.BUSINESS_RULES.SESSION_DURATION_MINUTES);
    if (!(0, utils_1.isSlotWithinOperatingHours)(startTime, endTime, operatingStart, operatingEnd)) {
        throw new errors_1.AppError(400, 'INVALID_SLOT', 'Time slot is outside operating hours');
    }
    return endTime;
}
function validateBookingWindow(date, startTime) {
    const hoursUntilStart = (0, utils_1.hoursUntil)(date, startTime);
    if (hoursUntilStart < constants_1.BUSINESS_RULES.BOOKING_MIN_LEAD_HOURS) {
        throw new errors_1.AppError(400, 'VALIDATION_ERROR', 'Date must be between 1 and 14 days from now.', [
            { field: 'date', message: 'Must be at least 24 hours in the future' },
        ]);
    }
    const maxHours = constants_1.BUSINESS_RULES.BOOKING_MAX_ADVANCE_DAYS * 24;
    if (hoursUntilStart > maxHours) {
        throw new errors_1.AppError(400, 'VALIDATION_ERROR', 'Date must be between 1 and 14 days from now.', [
            { field: 'date', message: 'Must be within 14 days' },
        ]);
    }
}
async function createBooking(clientId, payload, context) {
    const cached = getIdempotencyResponse(context.idempotencyKey);
    if (cached) {
        return cached;
    }
    const client = await prisma_1.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
        throw new errors_1.NotFoundError('Client');
    }
    if (client.bookingStatusCache !== 'NONE') {
        throw new errors_1.ConflictError('ACTIVE_BOOKING_EXISTS', 'You already have an active booking. Cancel it before creating a new one.', {
            currentBookingId: client.currentBookingId,
            currentBookingStatus: client.bookingStatusCache,
        });
    }
    validateBookingWindow(payload.date, payload.startTime);
    const venue = await prisma_1.prisma.venue.findFirst({
        where: { id: payload.venueId, isActive: true },
    });
    if (!venue) {
        throw new errors_1.NotFoundError('Venue');
    }
    const endTime = ensureSlotValid(payload.date, payload.startTime, venue.operatingHoursStart, venue.operatingHoursEnd);
    const bookingDate = (0, utils_1.parseBusinessDate)(payload.date).startOf('day').toDate();
    const result = await (0, utils_1.withSerializableRetry)(async () => {
        return prisma_1.prisma.$transaction(async (tx) => {
            const freshClient = await tx.client.findUnique({ where: { id: clientId } });
            if (!freshClient) {
                throw new errors_1.NotFoundError('Client');
            }
            if (freshClient.bookingStatusCache !== 'NONE') {
                throw new errors_1.ConflictError('ACTIVE_BOOKING_EXISTS', 'You already have an active booking. Cancel it before creating a new one.', {
                    currentBookingId: freshClient.currentBookingId,
                    currentBookingStatus: freshClient.bookingStatusCache,
                });
            }
            let allocation;
            try {
                allocation = await (0, allocation_engine_1.allocate)({
                    venueId: venue.id,
                    date: bookingDate,
                    startTime: payload.startTime,
                    endTime,
                }, tx);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : '';
                if (message === 'SLOT_UNAVAILABLE') {
                    throw new errors_1.ConflictError('SLOT_UNAVAILABLE', 'No companion duo is available for this slot.');
                }
                throw error;
            }
            const pricing = (0, pricing_engine_1.calculatePrice)(venue.type);
            const softLockExpiresAt = new Date(Date.now() + constants_1.BUSINESS_RULES.SOFT_LOCK_MINUTES * 60 * 1000);
            const booking = await tx.booking.create({
                data: {
                    clientId,
                    venueId: venue.id,
                    captainId: allocation.captainId,
                    viceCaptainId: allocation.viceCaptainId,
                    allocationMode: allocation.mode,
                    captainShiftId: allocation.captainShiftId,
                    viceCaptainShiftId: allocation.viceCaptainShiftId,
                    clientNicknameSnapshot: freshClient.nickname,
                    duoStatus: 'PENDING',
                    duoQrCode: (0, utils_1.generateQrCode)(),
                    duoPinCode: (0, utils_1.generateNumericCode)(constants_1.BUSINESS_RULES.DUO_PIN_LENGTH),
                    qrCode: (0, utils_1.generateQrCode)(),
                    pinCode: (0, utils_1.generateNumericCode)(constants_1.BUSINESS_RULES.CLIENT_PIN_LENGTH),
                    date: bookingDate,
                    startTime: payload.startTime,
                    endTime,
                    durationMinutes: constants_1.BUSINESS_RULES.SESSION_DURATION_MINUTES,
                    status: client_1.BookingStatus.PENDING,
                    baseRate: pricing.baseRate,
                    vatAmount: pricing.vatAmount,
                    serviceFee: pricing.serviceFee,
                    grandTotal: pricing.grandTotal,
                    paymentHoldStatus: client_1.PaymentHoldStatus.NONE,
                    softLockExpiresAt,
                },
            });
            await tx.client.update({
                where: { id: clientId },
                data: {
                    currentBookingId: booking.id,
                    bookingStatusCache: 'PENDING',
                },
            });
            await tx.bookingAuditLog.create({
                data: {
                    bookingId: booking.id,
                    action: 'CREATED',
                    performedByType: client_1.ActorType.CLIENT,
                    performedById: clientId,
                    deviceId: context.deviceId,
                    pricingEngineVersion: constants_1.PRICING_ENGINE_VERSION,
                    allocationEngineVersion: constants_1.ALLOCATION_ENGINE_VERSION,
                    clientLatitude: context.clientLatitude,
                    clientLongitude: context.clientLongitude,
                },
            });
            return {
                booking,
                pricing,
            };
        }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
    });
    await paymentService.holdAmount(result.pricing.grandTotal.toString());
    await confirmBooking(result.booking.id);
    const response = {
        bookingId: result.booking.id,
        status: result.booking.status,
        softLockExpiresAt: result.booking.softLockExpiresAt,
        pricing: {
            baseRate: result.pricing.baseRate,
            vatAmount: result.pricing.vatAmount,
            serviceFee: result.pricing.serviceFee,
            grandTotal: result.pricing.grandTotal,
            currency: result.pricing.currency,
        },
    };
    setIdempotencyResponse(context.idempotencyKey, response);
    return response;
}
async function confirmBooking(bookingId) {
    const now = new Date();
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    if (booking.status !== client_1.BookingStatus.PENDING) {
        return booking;
    }
    if (booking.softLockExpiresAt && booking.softLockExpiresAt < now) {
        await failBooking(bookingId, 'Soft-lock expired');
        return booking;
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const fresh = await tx.booking.findUnique({ where: { id: bookingId } });
        if (!fresh || fresh.status !== client_1.BookingStatus.PENDING) {
            return fresh;
        }
        const confirmed = await tx.booking.update({
            where: { id: bookingId },
            data: {
                status: client_1.BookingStatus.CONFIRMED,
                paymentHoldStatus: client_1.PaymentHoldStatus.HELD,
                paymentHoldAmount: fresh.grandTotal,
                softLockExpiresAt: null,
            },
        });
        await tx.client.update({
            where: { id: fresh.clientId },
            data: { bookingStatusCache: 'CONFIRMED' },
        });
        await tx.bookingAuditLog.create({
            data: {
                bookingId: fresh.id,
                action: 'CONFIRMED',
                performedByType: client_1.ActorType.SYSTEM,
                performedById: fresh.clientId,
            },
        });
        return confirmed;
    });
    if (updated) {
        await (0, notification_service_1.sendNotification)({
            recipientType: client_1.ActorType.CLIENT,
            recipientId: updated.clientId,
            bookingId: updated.id,
            notificationType: 'BOOKING_CONFIRMED',
        });
    }
    return updated;
}
async function failBooking(bookingId, reason) {
    await prisma_1.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({ where: { id: bookingId } });
        if (!booking) {
            throw new errors_1.NotFoundError('Booking');
        }
        await tx.booking.update({
            where: { id: bookingId },
            data: {
                status: client_1.BookingStatus.FAILED,
                failureReason: reason,
                paymentHoldStatus: client_1.PaymentHoldStatus.VOIDED,
            },
        });
        await tx.client.update({
            where: { id: booking.clientId },
            data: { currentBookingId: null, bookingStatusCache: 'NONE' },
        });
        await tx.bookingAuditLog.create({
            data: {
                bookingId,
                action: 'FAILED',
                performedByType: client_1.ActorType.SYSTEM,
                performedById: booking.clientId,
            },
        });
    });
    await paymentService.voidHold(bookingId);
}
async function getBookingStatus(clientId, bookingId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    if (booking.clientId !== clientId) {
        throw new errors_1.AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
    }
    return {
        bookingId: booking.id,
        status: booking.status,
        duoStatus: booking.duoStatus,
        softLockExpiresAt: booking.softLockExpiresAt,
    };
}
async function getBookingDetails(clientId, bookingId) {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { venue: true },
    });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    if (booking.clientId !== clientId) {
        throw new errors_1.AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
    }
    const bookingDate = booking.date.toISOString().slice(0, 10);
    const startDateTime = (0, utils_1.buildBusinessDateTime)(bookingDate, booking.startTime);
    const revealTime = startDateTime.subtract(30, 'minute');
    const now = (0, utils_1.nowBusiness)();
    const shouldReveal = now.isSame(startDateTime, 'day') &&
        (now.isAfter(revealTime) || now.isSame(revealTime));
    return {
        bookingId: booking.id,
        status: booking.status,
        venue: {
            id: booking.venue.id,
            name: booking.venue.name,
            type: booking.venue.type,
            address: booking.venue.address,
        },
        date: booking.date.toISOString().slice(0, 10),
        startTime: booking.startTime,
        endTime: booking.endTime,
        pricing: {
            baseRate: booking.baseRate,
            vatAmount: booking.vatAmount,
            serviceFee: booking.serviceFee,
            grandTotal: booking.grandTotal,
            currency: 'AED',
        },
        qrCode: shouldReveal ? booking.qrCode : null,
        pinCode: shouldReveal ? booking.pinCode : null,
        duoStatus: booking.duoStatus,
        createdAt: booking.createdAt,
    };
}
async function cancelBooking(clientId, bookingId, reason, cancelledBy = client_1.CancelledBy.CLIENT, actorId) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    if (booking.clientId !== clientId && cancelledBy === client_1.CancelledBy.CLIENT) {
        throw new errors_1.AppError(403, 'OWNERSHIP_MISMATCH', 'Access denied');
    }
    const cancellableStatuses = [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED];
    if (!cancellableStatuses.includes(booking.status)) {
        throw new errors_1.AppError(400, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled in its current state.');
    }
    const hoursUntilStart = (0, utils_1.hoursUntil)(booking.date.toISOString().slice(0, 10), booking.startTime);
    const refund = (0, refund_engine_1.calculateRefund)(booking.grandTotal, hoursUntilStart);
    const refundPercentage = Number(refund.refundPercentage);
    const paymentHoldStatus = refundPercentage === 100 ? client_1.PaymentHoldStatus.VOIDED : client_1.PaymentHoldStatus.REFUNDED;
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const cancelled = await tx.booking.update({
            where: { id: bookingId },
            data: {
                status: client_1.BookingStatus.CANCELLED,
                cancelledBy,
                cancelledAt: new Date(),
                cancellationReason: reason,
                refundPercentage: refund.refundPercentage,
                refundAmount: refund.refundAmount,
                paymentHoldStatus,
            },
        });
        await tx.client.update({
            where: { id: booking.clientId },
            data: { currentBookingId: null, bookingStatusCache: 'NONE' },
        });
        await tx.bookingAuditLog.create({
            data: {
                bookingId,
                action: 'CANCELLED',
                performedByType: cancelledBy === client_1.CancelledBy.CLIENT ? client_1.ActorType.CLIENT : client_1.ActorType.ADMIN,
                performedById: actorId ?? booking.clientId,
            },
        });
        return cancelled;
    });
    await paymentService.refund(booking.id, refund.refundAmount.toString());
    await (0, notification_service_1.sendNotification)({
        recipientType: client_1.ActorType.CLIENT,
        recipientId: booking.clientId,
        bookingId: booking.id,
        notificationType: 'CANCELLATION',
    });
    return {
        bookingId: updated.id,
        status: updated.status,
        refundPercentage: refundPercentage,
        refundAmount: refund.refundAmount,
    };
}
async function getCurrentBooking(clientId) {
    const client = await prisma_1.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
        throw new errors_1.NotFoundError('Client');
    }
    if (!client.currentBookingId) {
        return { hasActiveBooking: false, bookingId: null, status: null };
    }
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: client.currentBookingId } });
    const terminalStatuses = [
        client_1.BookingStatus.COMPLETED,
        client_1.BookingStatus.CANCELLED,
        client_1.BookingStatus.FAILED,
    ];
    if (!booking || terminalStatuses.includes(booking.status)) {
        await prisma_1.prisma.client.update({
            where: { id: client.id },
            data: { currentBookingId: null, bookingStatusCache: 'NONE' },
        });
        logger_1.logger.warn({ clientId, bookingId: client.currentBookingId }, 'Client booking cache corrected');
        return { hasActiveBooking: false, bookingId: null, status: null };
    }
    return {
        hasActiveBooking: true,
        bookingId: booking.id,
        status: booking.status,
    };
}
