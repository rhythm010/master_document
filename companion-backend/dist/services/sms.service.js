"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtp = sendOtp;
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
async function sendOtp(phoneNumber, _otp) {
    if (!env_1.env.MOCK_SMS_ENABLED) {
        logger_1.logger.warn({ phoneNumber }, 'SMS service disabled, OTP not sent');
        return;
    }
    logger_1.logger.info({ phoneNumber }, 'Mock SMS OTP sent');
}
