"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY = exports.BUSINESS_TIMEZONE = exports.ALLOCATION_ENGINE_VERSION = exports.PRICING_ENGINE_VERSION = exports.PRICING = exports.REFUND_TIERS = exports.BUSINESS_RULES = void 0;
exports.BUSINESS_RULES = {
    SESSION_DURATION_MINUTES: 120,
    SOFT_LOCK_MINUTES: 15,
    BOOKING_MIN_LEAD_HOURS: 24,
    BOOKING_MAX_ADVANCE_DAYS: 14,
    REST_BUFFER_MINUTES: 20,
    INTER_BOOKING_BUFFER_MINUTES: 30,
    DUO_BREACH_MINUTES_BEFORE_START: 20,
    CLIENT_NO_SHOW_MINUTES_AFTER_START: 15,
    COMPANION_DETAIL_REVEAL_HOURS: 4,
    SHIFT_CANCEL_PENALTY_HOURS: 4,
    QR_MAX_ATTEMPTS: 2,
    CLIENT_PIN_LENGTH: 4,
    DUO_PIN_LENGTH: 6,
    OTP_LENGTH: 6,
    OTP_EXPIRY_SECONDS: 300,
};
exports.REFUND_TIERS = {
    FULL: { minHours: 24, percentage: 100 },
    PARTIAL: { minHours: 7, percentage: 50 },
    NONE: { minHours: 0, percentage: 0 },
};
exports.PRICING = {
    MALL: { baseRate: 500, vatRate: 0.05, serviceFee: 50 },
    CLUB: { baseRate: 600, vatRate: 0.05, serviceFee: 60 },
    RESTAURANT: { baseRate: 400, vatRate: 0.05, serviceFee: 40 },
};
exports.PRICING_ENGINE_VERSION = '1.0';
exports.ALLOCATION_ENGINE_VERSION = '1.0';
exports.BUSINESS_TIMEZONE = 'Asia/Dubai';
exports.CURRENCY = 'AED';
