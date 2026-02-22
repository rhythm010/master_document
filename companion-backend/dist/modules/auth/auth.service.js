"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestOtp = requestOtp;
exports.verifyOtp = verifyOtp;
exports.adminLogin = adminLogin;
exports.refreshToken = refreshToken;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
const constants_1 = require("../../config/constants");
const utils_1 = require("../../shared/utils");
const errors_1 = require("../../shared/errors");
const sms_service_1 = require("../../services/sms.service");
const otpStore = new Map();
const otpRateLimit = new Map();
const OTP_WINDOW_MS = 5 * 60 * 1000;
const OTP_REQUEST_LIMIT = 3;
function issueToken(payload, expiresIn) {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, { expiresIn });
}
async function requestOtp(phoneNumber) {
    const now = Date.now();
    const rateEntry = otpRateLimit.get(phoneNumber);
    if (rateEntry && now - rateEntry.windowStart < OTP_WINDOW_MS) {
        if (rateEntry.count >= OTP_REQUEST_LIMIT) {
            throw new errors_1.AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many OTP requests. Try again in 5 minutes.');
        }
        rateEntry.count += 1;
    }
    else {
        otpRateLimit.set(phoneNumber, { count: 1, windowStart: now });
    }
    const otp = (0, utils_1.generateNumericCode)(constants_1.BUSINESS_RULES.OTP_LENGTH);
    const hash = await bcrypt_1.default.hash(otp, 10);
    otpStore.set(phoneNumber, {
        hash,
        expiresAt: now + env_1.env.OTP_EXPIRY_SECONDS * 1000,
    });
    await (0, sms_service_1.sendOtp)(phoneNumber, otp);
    return { message: 'OTP sent', expiresInSeconds: env_1.env.OTP_EXPIRY_SECONDS };
}
async function verifyOtp(phoneNumber, otp) {
    const entry = otpStore.get(phoneNumber);
    if (!entry || entry.expiresAt < Date.now()) {
        otpStore.delete(phoneNumber);
        throw new errors_1.AppError(401, 'INVALID_OTP', 'OTP is invalid or expired.');
    }
    const valid = await bcrypt_1.default.compare(otp, entry.hash);
    if (!valid) {
        throw new errors_1.AppError(401, 'INVALID_OTP', 'OTP is invalid or expired.');
    }
    otpStore.delete(phoneNumber);
    let client = await prisma_1.prisma.client.findUnique({ where: { phoneNumber } });
    let isNewUser = false;
    if (!client) {
        client = await prisma_1.prisma.client.create({
            data: {
                fullName: '',
                nickname: '',
                phoneNumber,
            },
        });
        isNewUser = true;
    }
    const accessToken = issueToken({ sub: client.id, role: 'CLIENT' }, '1h');
    const refreshToken = issueToken({ sub: client.id, role: 'CLIENT' }, '30d');
    return { accessToken, refreshToken, client, isNewUser };
}
async function adminLogin(email, password) {
    const admin = await prisma_1.prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
        throw new errors_1.AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const valid = await bcrypt_1.default.compare(password, admin.password);
    if (!valid) {
        throw new errors_1.AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const accessToken = issueToken({ sub: admin.id, role: admin.role }, '8h');
    return { accessToken, admin };
}
async function refreshToken(refreshToken) {
    try {
        const payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_SECRET);
        if (payload.role !== 'CLIENT') {
            throw new Error('INVALID_ROLE');
        }
        const client = await prisma_1.prisma.client.findUnique({ where: { id: payload.sub } });
        if (!client) {
            throw new Error('MISSING_CLIENT');
        }
        const accessToken = issueToken({ sub: client.id, role: 'CLIENT' }, '1h');
        return { accessToken };
    }
    catch {
        throw new errors_1.AppError(401, 'INVALID_TOKEN', 'Invalid token');
    }
}
