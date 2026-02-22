import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export type VenueListParams = {
  q?: string;
  latitude?: number;
  longitude?: number;
};

export async function listVenues(params: VenueListParams) {
  const { q, latitude, longitude } = params;

  if (latitude !== undefined && longitude !== undefined) {
    const searchTerm = q ? `%${q}%` : '%';
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        type: string;
        address: string;
        latitude: number;
        longitude: number;
        country: string;
        operatingHoursStart: string;
        operatingHoursEnd: string;
        distanceKm: number | null;
      }>
    >(Prisma.sql`
      SELECT id,
        name,
        type,
        address,
        latitude,
        longitude,
        country,
        operating_hours_start as "operatingHoursStart",
        operating_hours_end as "operatingHoursEnd",
        (6371 * acos(least(1, greatest(-1,
          cos(radians(${latitude})) * cos(radians(latitude::double precision)) *
          cos(radians(longitude::double precision) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(latitude::double precision))
        )))) AS "distanceKm"
      FROM venues
      WHERE is_active = true
        AND name ILIKE ${searchTerm}
      ORDER BY "distanceKm" ASC NULLS LAST;
    `);
    return results;
  }

  const venues = await prisma.venue.findMany({
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
