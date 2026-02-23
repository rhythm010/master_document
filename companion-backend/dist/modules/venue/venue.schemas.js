"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenuesSchema = void 0;
const zod_1 = require("zod");
exports.listVenuesSchema = zod_1.z.object({
    query: zod_1.z.object({
        q: zod_1.z.string().min(2).optional(),
        latitude: zod_1.z.coerce.number().optional(),
        longitude: zod_1.z.coerce.number().optional(),
    }).refine((data) => {
        if ((data.latitude === undefined) !== (data.longitude === undefined)) {
            return false;
        }
        return true;
    }, { message: 'latitude and longitude must be provided together' }),
});
