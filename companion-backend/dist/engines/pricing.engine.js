"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePrice = calculatePrice;
const client_1 = require("@prisma/client");
const constants_1 = require("../config/constants");
function calculatePrice(venueType) {
    const pricing = constants_1.PRICING[venueType];
    const baseRate = new client_1.Prisma.Decimal(pricing.baseRate.toFixed(2));
    const vatAmount = baseRate.mul(pricing.vatRate).toDecimalPlaces(2);
    const serviceFee = new client_1.Prisma.Decimal(pricing.serviceFee.toFixed(2));
    const grandTotal = baseRate.add(vatAmount).add(serviceFee).toDecimalPlaces(2);
    return {
        baseRate,
        vatAmount,
        serviceFee,
        grandTotal,
        currency: constants_1.CURRENCY,
    };
}
