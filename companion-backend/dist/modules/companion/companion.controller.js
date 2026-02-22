"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBookings = listBookings;
exports.getBooking = getBooking;
const response_1 = require("../../shared/response");
const companion_service_1 = require("./companion.service");
async function listBookings(req, res) {
    const data = await (0, companion_service_1.listCompanionBookings)(req.user.id);
    return (0, response_1.ok)(res, { bookings: data });
}
async function getBooking(req, res) {
    const { id } = req.validated?.params;
    const data = await (0, companion_service_1.getCompanionBooking)(req.user.id, id);
    return (0, response_1.ok)(res, data);
}
