"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelBookingSchema = exports.bookingIdParamsSchema = exports.createBookingSchema = void 0;
const zod_1 = require("zod");
exports.createBookingSchema = zod_1.z.object({
    body: zod_1.z.object({
        venueId: zod_1.z.string().uuid(),
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    }),
});
exports.bookingIdParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
});
exports.cancelBookingSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z.object({
        reason: zod_1.z.string().max(500).optional(),
    }),
});
