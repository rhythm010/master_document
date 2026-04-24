import type { DbClient } from "../../shared/db/prisma";
import { combineDateAndTime } from "../../shared/utils/time";
import { rosterRepository } from "./roster.repository";

// Slot length, spacing, and planning window for roster generation.
const SLOT_DURATION_MS = 2 * 60 * 60 * 1000;
const SLOT_INTERVAL_MS = 30 * 60 * 1000;
const DAYS_TO_POPULATE = 7;

export const rosterService = {
  // Creates venue assignments and pre-populates available roster slots for a companion.
  async populateForCompanion(db: DbClient, companionId: string) {
    const venues = await rosterRepository.listVenues(db);
    if (venues.length === 0) {
      return { slotsCreated: 0 };
    }

    // Ensure the companion is assigned to all venues before slot creation.
    await rosterRepository.createCompanionVenueAssignments(
      db,
      venues.map((venue) => ({ companionId, venueId: venue.id }))
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

        // Slide a cursor across the day, creating fixed-length slots on a fixed interval.
        for (
          let cursor = new Date(openAt);
          cursor.getTime() + SLOT_DURATION_MS <= closeAt.getTime();
          cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MS)
        ) {
          slots.push({
            venueId: venue.id,
            companionId,
            startAt: new Date(cursor),
            endAt: new Date(cursor.getTime() + SLOT_DURATION_MS),
            status: "AVAILABLE"
          });
        }
      }

      if (slots.length > 0) {
        // Batch insert for this venue and tally the total created.
        const result = await rosterRepository.createRosterSlots(db, slots);
        totalCreated += result.count ?? 0;
      }
    }

    return { slotsCreated: totalCreated };
  }
};
