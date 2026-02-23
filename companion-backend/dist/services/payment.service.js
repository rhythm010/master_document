"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.holdAmount = holdAmount;
exports.chargeHold = chargeHold;
exports.voidHold = voidHold;
exports.refund = refund;
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function holdAmount(amount) {
    await sleep(env_1.env.MOCK_PAYMENT_DELAY_MS);
    logger_1.logger.info({ amount }, 'Mock payment hold successful');
    return { success: true };
}
async function chargeHold(bookingId) {
    logger_1.logger.info({ bookingId }, 'Mock payment charged');
}
async function voidHold(bookingId) {
    logger_1.logger.info({ bookingId }, 'Mock payment voided');
}
async function refund(bookingId, amount) {
    logger_1.logger.info({ bookingId, amount }, 'Mock payment refunded');
}
