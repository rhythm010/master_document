import type { DbClient } from "../../shared/db/prisma";
import { combineDateAndTime } from "../../shared/utils/time";
import { rosterRepository } from "./roster.repository";

const SLOT_DURATION_MS = 2 * 60 * 60 * 1000;
const SLOT_INTERVAL_MS = 30 * 60 * 1000;
const DAYS_TO_POPULATE = 7;

export const rosterService = {
  async populateForCompanion(db: DbClient, companionId: string) {
    const venues = await rosterRepository.listVenues(db);
    if (venues.length === 0) {
      return { slotsCreated: 0 };
    }

    await rosterRepository.createCompanionVenueAssignments(
      db,
      venues.map((venue) => ({ companionId, venueId: venue.id }))
    );

    let totalCreated = 0;
    const baseDate = new Date();
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
        const result = await rosterRepository.createRosterSlots(db, slots);
        totalCreated += result.count ?? 0;
      }
    }

    return { slotsCreated: totalCreated };
  }
};
