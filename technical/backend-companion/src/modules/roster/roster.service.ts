import type { UserRole } from "../../shared/types/enums";
import { prisma, type DbClient } from "../../shared/db/prisma";
import { combineDateAndTime } from "../../shared/utils/time";

import { rosterRepository } from "./roster.repository";
import { rosterErrors } from "./roster.errors";
import type {
  AvailabilityResponseDTO,
  ListVenuesResponseDTO,
  PopulateForCompanionResponseDTO,
  ReleaseSlotsResponseDTO,
  ReserveSlotsResponseDTO,
  VenueListItemDTO
} from "./roster.types";

// Slot length, spacing, and planning window for roster generation.
const SLOT_DURATION_MS = 2 * 60 * 60 * 1000;
const SLOT_INTERVAL_MS = 30 * 60 * 1000;
const DAYS_TO_POPULATE = 7;
const VENUE_SEARCH_LIMIT = 20;

export const rosterService = {
  // Search venues by substring.
  async listVenues(query: string): Promise<ListVenuesResponseDTO> {
    const venues = await rosterRepository.searchVenues(prisma, query, VENUE_SEARCH_LIMIT);
    return {
      items: venues.map(toVenueListItem)
    };
  },

  // Compute availability start times for a venue and day.
  async getAvailability(input: { venueId: string; date: string }): Promise<AvailabilityResponseDTO> {
    const venue = await rosterRepository.findVenueById(prisma, input.venueId);
    if (!venue) {
      throw rosterErrors.venueNotFound();
    }

    const dateValue = parseLocalDate(input.date);
    const openAt = combineDateAndTime(dateValue, venue.operatingHoursStart);
    const closeAt = combineDateAndTime(dateValue, venue.operatingHoursEnd);

    // Per feature SDS constraint: Phase 1 does not support cross-midnight operating hours.
    // If the configured hours are invalid for the requested date, treat the venue as having
    // no availability instead of returning a 400.
    if (closeAt.getTime() <= openAt.getTime()) {
      return {
        venueId: input.venueId,
        date: input.date,
        durationMinutes: 120,
        availableStartTimes: []
      };
    }

    // Backfill roster slots for companions assigned to this venue.
    const companionIds = await rosterRepository.listCompanionIdsAssignedToVenue(prisma, input.venueId);
    if (companionIds.length > 0) {
      const slots = buildSlotsForDate({
        venueId: input.venueId,
        companionIds,
        openAt,
        closeAt
      });

      if (slots.length > 0) {
        await rosterRepository.createRosterSlots(prisma, slots);
      }
    }

    const windows = await rosterRepository.listAvailableWindows(prisma, {
      venueId: input.venueId,
      openAt,
      closeAt
    });

    return {
      venueId: input.venueId,
      date: input.date,
      durationMinutes: 120,
      availableStartTimes: windows.map((window) => window.startAt.toISOString())
    };
  },

  // Populate roster slots for a companion across a given set of venue ids.
  async populateForCompanion(input: {
    companionId: string;
    venueIds: string[];
  }): Promise<PopulateForCompanionResponseDTO> {
    const user = await rosterRepository.findUserById(prisma, input.companionId);
    if (!user || user.role !== ("COMPANION" satisfies UserRole)) {
      throw rosterErrors.companionNotFound();
    }

    const venues = await rosterRepository.findVenuesByIds(prisma, input.venueIds);
    if (venues.length !== input.venueIds.length) {
      throw rosterErrors.venueNotFound();
    }

    await rosterRepository.createCompanionVenueAssignments(
      prisma,
      input.venueIds.map((venueId) => ({ companionId: input.companionId, venueId }))
    );

    let totalCreated = 0;
    const baseDate = new Date();
    // Normalize to start-of-day so day offsets are consistent.
    baseDate.setHours(0, 0, 0, 0);

    for (const venue of venues) {
      const slots = [] as {
        venueId: string;
        companionId: string;
        startAt: Date;
        endAt: Date;
        status: "AVAILABLE" | "BOOKED";
      }[];

      for (let dayOffset = 0; dayOffset < DAYS_TO_POPULATE; dayOffset += 1) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + dayOffset);

        const openAt = combineDateAndTime(date, venue.operatingHoursStart);
        const closeAt = combineDateAndTime(date, venue.operatingHoursEnd);
        if (closeAt.getTime() <= openAt.getTime()) {
          continue;
        }

        const alignedOpenAt = ceilDateToSlotBoundary(openAt);

        // Slide a cursor across the day, creating fixed-length slots on a fixed interval.
        for (
          let cursor = new Date(alignedOpenAt);
          cursor.getTime() + SLOT_DURATION_MS <= closeAt.getTime();
          cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MS)
        ) {
          slots.push({
            venueId: venue.id,
            companionId: input.companionId,
            startAt: new Date(cursor),
            endAt: new Date(cursor.getTime() + SLOT_DURATION_MS),
            status: "AVAILABLE"
          });
        }
      }

      if (slots.length > 0) {
        const result = await rosterRepository.createRosterSlots(prisma, slots);
        totalCreated += result.count ?? 0;
      }
    }

    return {
      companionId: input.companionId,
      slotsCreated: totalCreated
    };
  },

  // Reserve one CAPTAIN and one VICE_CAPTAIN roster slot for the requested window.
  async reserveSlots(input: {
    venueId: string;
    startAt: string;
    endAt: string;
    bookingId: string;
  }): Promise<ReserveSlotsResponseDTO> {
    const startAt = parseIsoInstant(input.startAt);
    const endAt = parseIsoInstant(input.endAt);

    ensureValidReservationWindow({ startAt, endAt });

    return prisma.$transaction(async (tx) =>
      reserveSlotsCore(tx, {
        venueId: input.venueId,
        startAt,
        endAt,
        bookingId: input.bookingId
      })
    );
  },

  // Reserve slots using an existing transaction client (caller owns transaction boundary).
  async reserveSlotsWithDb(
    db: DbClient,
    input: { venueId: string; startAt: Date; endAt: Date; bookingId: string }
  ): Promise<ReserveSlotsResponseDTO> {
    ensureValidReservationWindow({ startAt: input.startAt, endAt: input.endAt });
    return reserveSlotsCore(db, input);
  },

  // Release all roster slots for a booking.
  async releaseSlots(bookingId: string): Promise<ReleaseSlotsResponseDTO> {
    return rosterService.releaseSlotsWithDb(prisma, bookingId);
  },

  // Release roster slots using an existing transaction client (caller owns transaction boundary).
  async releaseSlotsWithDb(db: DbClient, bookingId: string): Promise<ReleaseSlotsResponseDTO> {
    const result = await rosterRepository.releaseSlotsForBooking(db, bookingId);
    return {
      released: true,
      slotsReleased: result.count ?? 0
    };
  }
};

// Parse YYYY-MM-DD into a local Date at midnight.
function parseLocalDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw rosterErrors.validationError("Invalid date");
  }
  return date;
}

// Parse an ISO-8601 instant for timestamp inputs.
function parseIsoInstant(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw rosterErrors.validationError("Invalid timestamp");
  }
  return date;
}

// Ensure an internal reserve request uses the roster's fixed 2-hour windows on 30-minute boundaries.
function ensureValidReservationWindow(input: { startAt: Date; endAt: Date }) {
  const durationMs = input.endAt.getTime() - input.startAt.getTime();
  if (durationMs !== SLOT_DURATION_MS) {
    throw rosterErrors.validationError("Invalid reservation window: duration must be exactly 2 hours");
  }

  const isAlignedToThirtyMinutes =
    input.startAt.getUTCSeconds() === 0 &&
    input.startAt.getUTCMilliseconds() === 0 &&
    input.startAt.getUTCMinutes() % 30 === 0;
  if (!isAlignedToThirtyMinutes) {
    throw rosterErrors.validationError(
      "Invalid reservation window: startAt must be aligned to a 30-minute boundary"
    );
  }
}

// Reserve slots in the roster using the provided database client.
async function reserveSlotsCore(
  db: DbClient,
  input: { venueId: string; startAt: Date; endAt: Date; bookingId: string }
): Promise<ReserveSlotsResponseDTO> {
  const [captainSlot] = await rosterRepository.lockOneSlotForDesignation(db, {
    venueId: input.venueId,
    startAt: input.startAt,
    endAt: input.endAt,
    designation: "CAPTAIN"
  });
  const [viceSlot] = await rosterRepository.lockOneSlotForDesignation(db, {
    venueId: input.venueId,
    startAt: input.startAt,
    endAt: input.endAt,
    designation: "VICE_CAPTAIN"
  });

  if (!captainSlot || !viceSlot) {
    throw rosterErrors.noDuoAvailable();
  }

  const result = await rosterRepository.bookSlotsForBooking(db, {
    slotIds: [captainSlot.id, viceSlot.id],
    bookingId: input.bookingId
  });

  if ((result.count ?? 0) !== 2) {
    throw rosterErrors.noDuoAvailable();
  }

  return {
    reserved: true,
    captainSlotId: captainSlot.id,
    viceCaptainSlotId: viceSlot.id
  };
}

// Ceil an opening time up to the next 30-minute slot boundary.
function ceilDateToSlotBoundary(openAt: Date) {
  const intervalMinutes = SLOT_INTERVAL_MS / (60 * 1000);
  const cursor = new Date(openAt);
  const minutes = cursor.getMinutes();
  const seconds = cursor.getSeconds();
  const milliseconds = cursor.getMilliseconds();

  const remainder = minutes % intervalMinutes;
  const isAligned = remainder === 0 && seconds === 0 && milliseconds === 0;
  if (isAligned) {
    cursor.setSeconds(0, 0);
    return cursor;
  }

  cursor.setSeconds(0, 0);
  const minutesToAdd = remainder === 0 ? intervalMinutes : intervalMinutes - remainder;
  cursor.setMinutes(minutes + minutesToAdd);
  return cursor;
}

// Build candidate roster slots for a venue/day and set of companions.
function buildSlotsForDate(input: {
  venueId: string;
  companionIds: string[];
  openAt: Date;
  closeAt: Date;
}) {
  const slots = [] as {
    venueId: string;
    companionId: string;
    startAt: Date;
    endAt: Date;
    status: "AVAILABLE" | "BOOKED";
  }[];

  const alignedOpenAt = ceilDateToSlotBoundary(input.openAt);

  for (const companionId of input.companionIds) {
    for (
      let cursor = new Date(alignedOpenAt);
      cursor.getTime() + SLOT_DURATION_MS <= input.closeAt.getTime();
      cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MS)
    ) {
      slots.push({
        venueId: input.venueId,
        companionId,
        startAt: new Date(cursor),
        endAt: new Date(cursor.getTime() + SLOT_DURATION_MS),
        status: "AVAILABLE"
      });
    }
  }

  return slots;
}

// Map a Prisma venue record into the public venue list DTO.
function toVenueListItem(venue: {
  id: string;
  name: string;
  address: string;
  venueType: VenueListItemDTO["venueType"];
  latitude: unknown;
  longitude: unknown;
  operatingHoursStart: Date;
  operatingHoursEnd: Date;
}): VenueListItemDTO {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    venueType: venue.venueType,
    latitude: Number(venue.latitude),
    longitude: Number(venue.longitude),
    operatingHoursStart: formatTime(venue.operatingHoursStart),
    operatingHoursEnd: formatTime(venue.operatingHoursEnd)
  };
}

// Format a Prisma TIME column (stored as Date) into HH:MM.
function formatTime(value: Date) {
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
