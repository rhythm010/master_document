"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVenues = listVenues;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
async function listVenues(params) {
    const { q, latitude, longitude } = params;
    if (latitude !== undefined && longitude !== undefined) {
        const searchTerm = q ? `%${q}%` : null;
        const results = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id,
        name,
        type,
        address,
        latitude,
        longitude,
        country,
        operating_hours_start as "operatingHoursStart",
        operating_hours_end as "operatingHoursEnd",
        (6371 * acos(
          cos(radians(${latitude})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(latitude))
        )) AS "distanceKm"
      FROM venues
      WHERE is_active = true
        AND (${searchTerm} IS NULL OR name ILIKE ${searchTerm})
      ORDER BY "distanceKm" ASC NULLS LAST;
    `);
        return results;
    }
    const venues = await prisma_1.prisma.venue.findMany({
        where: {
            isActive: true,
            ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { name: 'asc' },
    });
    return venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        type: venue.type,
        address: venue.address,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        country: venue.country,
        operatingHoursStart: venue.operatingHoursStart,
        operatingHoursEnd: venue.operatingHoursEnd,
        distanceKm: null,
    }));
}
