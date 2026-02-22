"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRefund = calculateRefund;
const client_1 = require("@prisma/client");
const constants_1 = require("../config/constants");
function calculateRefund(grandTotal, hoursUntilStart) {
    let refundPercentage = constants_1.REFUND_TIERS.NONE.percentage;
    if (hoursUntilStart > constants_1.REFUND_TIERS.FULL.minHours) {
        refundPercentage = constants_1.REFUND_TIERS.FULL.percentage;
    }
    else if (hoursUntilStart >= constants_1.REFUND_TIERS.PARTIAL.minHours) {
        refundPercentage = constants_1.REFUND_TIERS.PARTIAL.percentage;
    }
    const refundAmount = grandTotal
        .mul(new client_1.Prisma.Decimal(refundPercentage))
        .div(100)
        .toDecimalPlaces(2);
    return { refundPercentage, refundAmount };
}
