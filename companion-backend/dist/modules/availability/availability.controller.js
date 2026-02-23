"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailabilityHandler = getAvailabilityHandler;
const response_1 = require("../../shared/response");
const availability_service_1 = require("./availability.service");
async function getAvailabilityHandler(req, res) {
    const { venueId, date } = req.validated?.query;
    const data = await (0, availability_service_1.getAvailability)(venueId, date);
    const slots = data.slots.map((slot) => ({
        ...slot,
        pricing: slot.pricing
            ? {
                ...slot.pricing,
                baseRate: slot.pricing.baseRate.toString(),
                vatAmount: slot.pricing.vatAmount.toString(),
                serviceFee: slot.pricing.serviceFee.toString(),
                grandTotal: slot.pricing.grandTotal.toString(),
            }
            : null,
    }));
    return (0, response_1.ok)(res, {
        venueId: data.venueId,
        date: data.date,
        slots,
    });
}
