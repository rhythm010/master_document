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
exports.createAdminBooking = createAdminBooking;
exports.cancelAdminBooking = cancelAdminBooking;
exports.reassignBooking = reassignBooking;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
const constants_1 = require("../../config/constants");
const allocation_engine_1 = require("../../engines/allocation.engine");
const pricing_engine_1 = require("../../engines/pricing.engine");
const errors_1 = require("../../shared/errors");
const utils_1 = require("../../shared/utils");
const paymentService = __importStar(require("../../services/payment.service"));
const notification_service_1 = require("../../services/notification.service");
function determineMode(captainId, viceCaptainId) {
    if (captainId && viceCaptainId)
        return client_1.AllocationMode.BOTH_SPECIFIED;
    if (captainId)
        return client_1.AllocationMode.CAPTAIN_SPECIFIED;
    if (viceCaptainId)
        return client_1.AllocationMode.VICE_CAPTAIN_SPECIFIED;
    return client_1.AllocationMode.AUTO;
}
async function assertCompanionAvailable(companionId, role, date, startTime, endTime, excludeBookingId) {
    const shift = await prisma_1.prisma.shift.findFirst({
        where: {
            date,
            status: { in: [client_1.ShiftStatus.SCHEDULED, client_1.ShiftStatus.ACTIVE] },
            companion: {
                id: companionId,
                role,
                isActive: true,
                backgroundVerified: true,
                penaltyStatus: { not: client_1.PenaltyStatus.PENALIZED },
            },
        },
        include: { companion: true },
    });
    if (!shift) {
        throw new errors_1.ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
    }
    const startMinutes = (0, utils_1.parseTimeToMinutes)(startTime) - constants_1.BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
    const endMinutes = (0, utils_1.parseTimeToMinutes)(endTime) + constants_1.BUSINESS_RULES.REST_BUFFER_MINUTES;
    const shiftStart = (0, utils_1.parseTimeToMinutes)(shift.startTime);
    const shiftEnd = (0, utils_1.parseTimeToMinutes)(shift.endTime);
    if (shiftStart > startMinutes || shiftEnd < endMinutes) {
        throw new errors_1.ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
    }
    const now = new Date();
    const bookings = await prisma_1.prisma.booking.findMany({
        where: {
            date,
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            AND: [
                {
                    OR: [
                        { status: { in: [client_1.BookingStatus.CONFIRMED, client_1.BookingStatus.ACTIVE] } },
                        { status: client_1.BookingStatus.PENDING, softLockExpiresAt: { gt: now } },
                    ],
                },
                { OR: [{ captainId: companionId }, { viceCaptainId: companionId }] },
            ],
        },
    });
    const overlaps = bookings.some((booking) => {
        const bookingStart = (0, utils_1.parseTimeToMinutes)(booking.startTime) - constants_1.BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
        const bookingEnd = (0, utils_1.parseTimeToMinutes)(booking.endTime) + constants_1.BUSINESS_RULES.REST_BUFFER_MINUTES;
        return bookingStart < endMinutes && bookingEnd > startMinutes;
    });
    if (overlaps) {
        throw new errors_1.ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
    }
    return shift.id;
}
async function createAdminBooking(adminId, payload) {
    const client = await prisma_1.prisma.client.findUnique({ where: { id: payload.clientId } });
    if (!client) {
        throw new errors_1.NotFoundError('Client');
    }
    if (client.bookingStatusCache !== 'NONE') {
        throw new errors_1.ConflictError('ACTIVE_BOOKING_EXISTS', 'Client already has an active booking.');
    }
    const venue = await prisma_1.prisma.venue.findFirst({ where: { id: payload.venueId, isActive: true } });
    if (!venue) {
        throw new errors_1.NotFoundError('Venue');
    }
    const endTime = (0, utils_1.calculateEndTime)(payload.startTime, constants_1.BUSINESS_RULES.SESSION_DURATION_MINUTES);
    if (!(0, utils_1.isSlotWithinOperatingHours)(payload.startTime, endTime, venue.operatingHoursStart, venue.operatingHoursEnd)) {
        throw new errors_1.AppError(400, 'INVALID_SLOT', 'Time slot is outside operating hours');
    }
    const bookingDate = (0, utils_1.parseBusinessDate)(payload.date).startOf('day').toDate();
    let allocation;
    try {
        allocation = await (0, allocation_engine_1.allocate)({
            venueId: venue.id,
            date: bookingDate,
            startTime: payload.startTime,
            endTime,
            captainId: payload.captainId ?? undefined,
            viceCaptainId: payload.viceCaptainId ?? undefined,
        }, prisma_1.prisma);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : '';
        const code = message === 'COMPANION_UNAVAILABLE' ? 'COMPANION_UNAVAILABLE' : 'SLOT_UNAVAILABLE';
        throw new errors_1.ConflictError(code, 'Specified companion is not available.');
    }
    const pricing = (0, pricing_engine_1.calculatePrice)(venue.type);
    const booking = await prisma_1.prisma.booking.create({
        data: {
            clientId: payload.clientId,
            venueId: venue.id,
            captainId: allocation.captainId,
            viceCaptainId: allocation.viceCaptainId,
            allocationMode: allocation.mode,
            captainShiftId: allocation.captainShiftId,
            viceCaptainShiftId: allocation.viceCaptainShiftId,
            clientNicknameSnapshot: client.nickname,
            duoStatus: 'PENDING',
            duoQrCode: (0, utils_1.generateQrCode)(),
            duoPinCode: (0, utils_1.generateNumericCode)(constants_1.BUSINESS_RULES.DUO_PIN_LENGTH),
            qrCode: (0, utils_1.generateQrCode)(),
            pinCode: (0, utils_1.generateNumericCode)(constants_1.BUSINESS_RULES.CLIENT_PIN_LENGTH),
            date: bookingDate,
            startTime: payload.startTime,
            endTime,
            durationMinutes: constants_1.BUSINESS_RULES.SESSION_DURATION_MINUTES,
            status: client_1.BookingStatus.CONFIRMED,
            baseRate: pricing.baseRate,
            vatAmount: pricing.vatAmount,
            serviceFee: pricing.serviceFee,
            grandTotal: pricing.grandTotal,
            paymentHoldStatus: client_1.PaymentHoldStatus.HELD,
            paymentHoldAmount: pricing.grandTotal,
        },
    });
    await prisma_1.prisma.client.update({
        where: { id: client.id },
        data: { currentBookingId: booking.id, bookingStatusCache: 'CONFIRMED' },
    });
    await prisma_1.prisma.bookingAuditLog.create({
        data: {
            bookingId: booking.id,
            action: 'CREATED',
            performedByType: client_1.ActorType.ADMIN,
            performedById: adminId,
            pricingEngineVersion: constants_1.PRICING_ENGINE_VERSION,
            allocationEngineVersion: constants_1.ALLOCATION_ENGINE_VERSION,
        },
    });
    return { booking, pricing };
}
async function cancelAdminBooking(adminId, bookingId, reason) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    const cancellableStatuses = [client_1.BookingStatus.PENDING, client_1.BookingStatus.CONFIRMED];
    if (!cancellableStatuses.includes(booking.status)) {
        throw new errors_1.AppError(400, 'BOOKING_NOT_CANCELLABLE', 'This booking cannot be cancelled in its current state.');
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const cancelled = await tx.booking.update({
            where: { id: bookingId },
            data: {
                status: client_1.BookingStatus.CANCELLED,
                cancelledBy: client_1.CancelledBy.ADMIN,
                cancelledAt: new Date(),
                cancellationReason: reason,
                refundPercentage: 100,
                refundAmount: booking.grandTotal,
                paymentHoldStatus: client_1.PaymentHoldStatus.REFUNDED,
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
                performedByType: client_1.ActorType.ADMIN,
                performedById: adminId,
            },
        });
        return cancelled;
    });
    await paymentService.refund(booking.id, booking.grandTotal.toString());
    await (0, notification_service_1.sendNotification)({
        recipientType: client_1.ActorType.CLIENT,
        recipientId: booking.clientId,
        bookingId: booking.id,
        notificationType: 'CANCELLATION',
    });
    return updated;
}
async function reassignBooking(adminId, bookingId, payload) {
    const booking = await prisma_1.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
        throw new errors_1.NotFoundError('Booking');
    }
    if (booking.status !== client_1.BookingStatus.CONFIRMED) {
        throw new errors_1.AppError(400, 'BOOKING_NOT_CANCELLABLE', 'Booking must be confirmed to reassign.');
    }
    if (!payload.captainId && !payload.viceCaptainId) {
        throw new errors_1.AppError(400, 'VALIDATION_ERROR', 'At least one companion must be provided.');
    }
    const newCaptainId = payload.captainId ?? booking.captainId;
    const newViceCaptainId = payload.viceCaptainId ?? booking.viceCaptainId;
    if (!newCaptainId || !newViceCaptainId) {
        throw new errors_1.ConflictError('COMPANION_UNAVAILABLE', 'Specified companion is not available.');
    }
    const captainShiftId = payload.captainId
        ? await assertCompanionAvailable(newCaptainId, client_1.CompanionRole.CAPTAIN, booking.date, booking.startTime, booking.endTime, booking.id)
        : booking.captainShiftId;
    const viceShiftId = payload.viceCaptainId
        ? await assertCompanionAvailable(newViceCaptainId, client_1.CompanionRole.VICE_CAPTAIN, booking.date, booking.startTime, booking.endTime, booking.id)
        : booking.viceCaptainShiftId;
    const allocationMode = determineMode(payload.captainId ?? undefined, payload.viceCaptainId ?? undefined);
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
            where: { id: bookingId },
            data: {
                captainId: newCaptainId,
                viceCaptainId: newViceCaptainId,
                captainShiftId: captainShiftId ?? undefined,
                viceCaptainShiftId: viceShiftId ?? undefined,
                allocationMode,
                duoStatus: 'PENDING',
                duoQrCode: (0, utils_1.generateQrCode)(),
                duoPinCode: (0, utils_1.generateNumericCode)(constants_1.BUSINESS_RULES.DUO_PIN_LENGTH),
            },
        });
        await tx.bookingAuditLog.create({
            data: {
                bookingId,
                action: 'REALLOCATED',
                performedByType: client_1.ActorType.ADMIN,
                performedById: adminId,
                metadata: {
                    oldCaptainId: booking.captainId,
                    oldViceCaptainId: booking.viceCaptainId,
                    newCaptainId,
                    newViceCaptainId,
                },
            },
        });
        return updatedBooking;
    });
    return updated;
}
