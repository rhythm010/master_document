"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(3000),
    NODE_ENV: zod_1.z.enum(['development', 'production']).default('development'),
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    DATABASE_URL: zod_1.z.string().url(),
    JWT_SECRET: zod_1.z.string().min(32),
    OTP_EXPIRY_SECONDS: zod_1.z.coerce.number().default(300),
    SOFT_LOCK_MINUTES: zod_1.z.coerce.number().default(15),
    BOOKING_MIN_LEAD_HOURS: zod_1.z.coerce.number().default(24),
    BOOKING_MAX_ADVANCE_DAYS: zod_1.z.coerce.number().default(14),
    SESSION_DURATION_MINUTES: zod_1.z.coerce.number().default(120),
    REST_BUFFER_MINUTES: zod_1.z.coerce.number().default(20),
    INTER_BOOKING_BUFFER_MINUTES: zod_1.z.coerce.number().default(30),
    COMPANION_DETAIL_REVEAL_HOURS: zod_1.z.coerce.number().default(4),
    DUO_BREACH_MINUTES_BEFORE_START: zod_1.z.coerce.number().default(20),
    CLIENT_NO_SHOW_MINUTES_AFTER_START: zod_1.z.coerce.number().default(15),
    SHIFT_CANCEL_PENALTY_HOURS: zod_1.z.coerce.number().default(4),
    MOCK_PAYMENT_DELAY_MS: zod_1.z.coerce.number().default(3000),
    MOCK_SMS_ENABLED: zod_1.z.coerce.boolean().default(true),
});
exports.env = envSchema.parse(process.env);
