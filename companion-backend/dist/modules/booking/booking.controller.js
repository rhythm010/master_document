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
exports.getBookingStatus = getBookingStatus;
exports.getBookingDetails = getBookingDetails;
exports.cancelBooking = cancelBooking;
exports.getCurrentBooking = getCurrentBooking;
const response_1 = require("../../shared/response");
const bookingService = __importStar(require("./booking.service"));
async function createBooking(req, res) {
    const { venueId, date, startTime } = req.validated?.body;
    const data = await bookingService.createBooking(req.user.id, { venueId, date, startTime }, {
        idempotencyKey: req.headers['idempotency-key'],
        deviceId: req.headers['x-device-id'],
        clientLatitude: req.headers['x-client-latitude']
            ? Number(req.headers['x-client-latitude'])
            : undefined,
        clientLongitude: req.headers['x-client-longitude']
            ? Number(req.headers['x-client-longitude'])
            : undefined,
    });
    return (0, response_1.created)(res, {
        ...data,
        softLockExpiresAt: data.softLockExpiresAt?.toISOString() ?? null,
        pricing: {
            ...data.pricing,
            baseRate: data.pricing.baseRate.toString(),
            vatAmount: data.pricing.vatAmount.toString(),
            serviceFee: data.pricing.serviceFee.toString(),
            grandTotal: data.pricing.grandTotal.toString(),
        },
    });
}
async function getBookingStatus(req, res) {
    const { id } = req.validated?.params;
    const data = await bookingService.getBookingStatus(req.user.id, id);
    return (0, response_1.ok)(res, {
        bookingId: data.bookingId,
        status: data.status,
        duoStatus: data.duoStatus,
        softLockExpiresAt: data.softLockExpiresAt,
    });
}
async function getBookingDetails(req, res) {
    const { id } = req.validated?.params;
    const data = await bookingService.getBookingDetails(req.user.id, id);
    return (0, response_1.ok)(res, {
        ...data,
        pricing: {
            ...data.pricing,
            baseRate: data.pricing.baseRate.toString(),
            vatAmount: data.pricing.vatAmount.toString(),
            serviceFee: data.pricing.serviceFee.toString(),
            grandTotal: data.pricing.grandTotal.toString(),
        },
        createdAt: data.createdAt.toISOString(),
    });
}
async function cancelBooking(req, res) {
    const { id } = req.validated?.params;
    const { reason } = req.validated?.body;
    const data = await bookingService.cancelBooking(req.user.id, id, reason);
    const refundPercentage = Number(data.refundPercentage);
    return (0, response_1.ok)(res, {
        bookingId: data.bookingId,
        status: data.status,
        refundPercentage,
        refundAmount: data.refundAmount.toString(),
        message: refundPercentage === 100
            ? 'Booking cancelled. Full refund will be processed.'
            : refundPercentage === 50
                ? 'Booking cancelled. Partial refund will be processed.'
                : 'Booking cancelled. No refund will be issued.',
    });
}
async function getCurrentBooking(req, res) {
    const data = await bookingService.getCurrentBooking(req.user.id);
    return (0, response_1.ok)(res, data);
}
