"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenuesHandler = listVenuesHandler;
const response_1 = require("../../shared/response");
const venue_service_1 = require("./venue.service");
async function listVenuesHandler(req, res) {
    const { q, latitude, longitude } = req.validated?.query;
    const venues = await (0, venue_service_1.listVenues)({ q, latitude, longitude });
    return (0, response_1.ok)(res, { venues });
}
