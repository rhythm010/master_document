"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminReassignSchema = exports.adminBookingIdSchema = exports.adminCreateBookingSchema = void 0;
const zod_1 = require("zod");
exports.adminCreateBookingSchema = zod_1.z.object({
    body: zod_1.z.object({
        clientId: zod_1.z.string().uuid(),
        venueId: zod_1.z.string().uuid(),
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
        captainId: zod_1.z.string().uuid().nullable().optional(),
        viceCaptainId: zod_1.z.string().uuid().nullable().optional(),
    }),
});
exports.adminBookingIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z
        .object({
        reason: zod_1.z.string().max(500).optional(),
    })
        .optional(),
});
exports.adminReassignSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid(),
    }),
    body: zod_1.z.object({
        captainId: zod_1.z.string().uuid().nullable().optional(),
        viceCaptainId: zod_1.z.string().uuid().nullable().optional(),
    }),
});
