"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilitySchema = void 0;
const zod_1 = require("zod");
exports.availabilitySchema = zod_1.z.object({
    query: zod_1.z.object({
        venueId: zod_1.z.string().uuid(),
        date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
});
