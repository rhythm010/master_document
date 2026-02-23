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
const response_1 = require("../../shared/response");
const adminService = __importStar(require("./admin.service"));
async function createAdminBooking(req, res) {
    const { clientId, venueId, date, startTime, captainId, viceCaptainId } = req.validated?.body;
    const data = await adminService.createAdminBooking(req.user.id, {
        clientId,
        venueId,
        date,
        startTime,
        captainId,
        viceCaptainId,
    });
    return (0, response_1.created)(res, {
        bookingId: data.booking.id,
        status: data.booking.status,
        pricing: {
            baseRate: data.pricing.baseRate.toString(),
            vatAmount: data.pricing.vatAmount.toString(),
            serviceFee: data.pricing.serviceFee.toString(),
            grandTotal: data.pricing.grandTotal.toString(),
            currency: data.pricing.currency,
        },
    });
}
async function cancelAdminBooking(req, res) {
    const { id } = req.validated?.params;
    const reason = req.validated?.body?.reason;
    const booking = await adminService.cancelAdminBooking(req.user.id, id, reason);
    return (0, response_1.ok)(res, {
        bookingId: booking.id,
        status: booking.status,
        refundPercentage: 100,
        refundAmount: booking.refundAmount?.toString() ?? booking.grandTotal.toString(),
        message: 'Booking cancelled. Full refund will be processed.',
    });
}
async function reassignBooking(req, res) {
    const { id } = req.validated?.params;
    const { captainId, viceCaptainId } = req.validated?.body;
    const booking = await adminService.reassignBooking(req.user.id, id, { captainId, viceCaptainId });
    return (0, response_1.ok)(res, {
        bookingId: booking.id,
        captainId: booking.captainId,
        viceCaptainId: booking.viceCaptainId,
        duoStatus: booking.duoStatus,
    });
}
