import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";
import { internalAuth } from "../../shared/middleware/internalAuth";
import { rosterController } from "./roster.controller";

const router = Router();

// Venue search endpoint used by clients before selecting a booking location.
router.get("/venues", authMiddleware, rosterController.listVenues);
// Availability endpoint used to find 2-hour booking windows at a venue.
router.get("/availability", authMiddleware, rosterController.getAvailability);

// Internal roster slot reservation and release endpoints used by Booking flows.
router.post("/roster-slots/reserve", internalAuth, rosterController.reserveSlots);
router.post("/roster-slots/release", internalAuth, rosterController.releaseSlots);
router.post(
  "/roster-slots/populate-for-companion",
  internalAuth,
  rosterController.populateForCompanion
);

export { router as rosterRouter };
