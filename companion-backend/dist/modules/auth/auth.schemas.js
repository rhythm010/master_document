"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.adminLoginSchema = exports.verifyOtpSchema = exports.requestOtpSchema = void 0;
const zod_1 = require("zod");
const phoneRegex = /^\+[1-9]\d{1,14}$/;
exports.requestOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phoneNumber: zod_1.z.string().regex(phoneRegex),
    }),
});
exports.verifyOtpSchema = zod_1.z.object({
    body: zod_1.z.object({
        phoneNumber: zod_1.z.string().regex(phoneRegex),
        otp: zod_1.z.string().regex(/^\d{6}$/),
    }),
});
exports.adminLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1),
    }),
});
