import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { logger } from "../logger";
import { calculateDistanceMeters } from "../utils/geo";
import { rosterService } from "../../modules/roster";
import { bookingRepository } from "../../modules/booking/booking.repository";

const JOB_INTERVALS_MS = {
  autoEnd: 30_000,
  nearEnd: 60_000,
  breachCheck: 60_000
} as const;

const NEAR_END_WINDOW_MINUTES = 15;
const VENUE_BREACH_METERS = 300;

/** Start in-process schedulers for the session-in-progress feature. */
export function startSessionInProgressSchedulers() {
  logger.info({ intervalsMs: JOB_INTERVALS_MS }, "session-in-progress schedulers starting");

  let autoEndRunning = false;
  let nearEndRunning = false;
  let breachRunning = false;

  setInterval(() => {
    if (autoEndRunning) {
      return;
    }

    autoEndRunning = true;
    void runJobSafe("session-auto-end", runSessionAutoEndJob)
      .finally(() => {
        autoEndRunning = false;
      });
  }, JOB_INTERVALS_MS.autoEnd);

  setInterval(() => {
    if (nearEndRunning) {
      return;
    }

    nearEndRunning = true;
    void runJobSafe("near-end-notification", runNearEndNotificationJob)
      .finally(() => {
        nearEndRunning = false;
      });
  }, JOB_INTERVALS_MS.nearEnd);

  setInterval(() => {
    if (breachRunning) {
      return;
    }

    breachRunning = true;
    void runJobSafe("companion-300m-breach-check", runCompanionBreachCheckJob)
      .finally(() => {
        breachRunning = false;
      });
  }, JOB_INTERVALS_MS.breachCheck);
}

// Run a job with structured error logging and duration metadata.
async function runJobSafe(name: string, job: () => Promise<void>) {
  const startedAt = Date.now();
  try {
    await job();
    logger.info({ job: name, durationMs: Date.now() - startedAt }, "scheduler job completed");
  } catch (error) {
    logger.error({ job: name, durationMs: Date.now() - startedAt, error }, "scheduler job failed");
  }
}

async function runSessionAutoEndJob() {
  const now = new Date();
  const due = await prisma.booking.findMany({
    where: {
      status: "ACTIVE",
      endAt: {
        lte: now
      }
    },
    select: {
      id: true
    },
    take: 50
  });

  if (due.length === 0) {
    return;
  }

  for (const row of due) {
    await prisma.$transaction(async (tx) => {
      const [booking] = await bookingRepository.lockBookingForExtension(tx, row.id);
      if (!booking) {
        return;
      }

      if (booking.status !== "ACTIVE") {
        return;
      }

      if (booking.endAt.getTime() > now.getTime()) {
        return;
      }

      await bookingRepository.updateBookingStatus(tx, booking.id, "COMPLETED");
      await rosterService.releaseSlotsWithDb(tx, booking.id);

      logger.info({ bookingId: booking.id }, "booking auto-ended");
    });
  }
}

async function runNearEndNotificationJob() {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      clientId: string;
      endAt: Date;
    }[]
  >(Prisma.sql`
    UPDATE "bookings" b
    SET near_end_notified_at = now()
    WHERE b.status = 'ACTIVE'
      AND b.near_end_notified_at IS NULL
      AND b.end_at <= now() + (${NEAR_END_WINDOW_MINUTES} * interval '1 minute')
    RETURNING b.id, b.client_id as "clientId", b.end_at as "endAt";
  `);

  for (const booking of rows) {
    logger.info(
      {
        event: "BOOKING_NEAR_END_NOTIFICATION",
        bookingId: booking.id,
        clientId: booking.clientId,
        endAt: booking.endAt.toISOString()
      },
      "near-end notification claimed (placeholder)"
    );
  }
}

async function runCompanionBreachCheckJob() {
  const activeBookings = await prisma.booking.findMany({
    where: {
      status: "ACTIVE"
    },
    select: {
      id: true,
      venueId: true,
      venue: {
        select: {
          latitude: true,
          longitude: true
        }
      },
      assignments: {
        select: {
          companionId: true,
          designation: true
        }
      },
      participantLocations: {
        select: {
          userId: true,
          latitude: true,
          longitude: true,
          updatedAt: true
        }
      }
    },
    take: 100
  });

  const occurredAt = new Date();

  for (const booking of activeBookings) {
    const venueLat = Number(booking.venue.latitude);
    const venueLng = Number(booking.venue.longitude);

    for (const assignment of booking.assignments) {
      const location = booking.participantLocations.find((row) => row.userId === assignment.companionId);
      if (!location) {
        continue;
      }

      const companionLat = Number(location.latitude);
      const companionLng = Number(location.longitude);

      const distanceMeters = calculateDistanceMeters({
        lat1: companionLat,
        lon1: companionLng,
        lat2: venueLat,
        lon2: venueLng
      });

      if (distanceMeters <= VENUE_BREACH_METERS) {
        continue;
      }

      logger.info(
        {
          event: "BOOKING_COMPANION_VENUE_BREACH",
          bookingId: booking.id,
          companionUserId: assignment.companionId,
          venueId: booking.venueId,
          designation: assignment.designation,
          distanceMeters,
          companionLat,
          companionLng,
          venueLat,
          venueLng,
          locationUpdatedAt: location.updatedAt.toISOString(),
          occurredAt: occurredAt.toISOString()
        },
        "companion venue breach detected (placeholder alerts)"
      );

      logger.info(
        {
          event: "ADMIN_ALERT_PLACEHOLDER",
          bookingId: booking.id,
          companionUserId: assignment.companionId,
          distanceMeters,
          occurredAt: occurredAt.toISOString()
        },
        "admin alert placeholder"
      );

      logger.info(
        {
          event: "COMPANION_PUSH_PLACEHOLDER",
          bookingId: booking.id,
          companionUserId: assignment.companionId,
          distanceMeters,
          occurredAt: occurredAt.toISOString()
        },
        "companion push placeholder"
      );
    }
  }
}
