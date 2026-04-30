import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";
import { internalAuth } from "../../shared/middleware/internalAuth";
import { requireRole } from "../../shared/middleware/requireRole";

import { bookingController } from "./booking.controller";

const router = Router();

// Create a booking at a venue start time for the authenticated client.
router.post("/bookings", authMiddleware, requireRole("CLIENT"), bookingController.createBooking);

// Cancel a booking (client owner or assigned companion only).
router.post("/bookings/:id/cancel", authMiddleware, bookingController.cancelBooking);

// Return booking details for the owning client.
router.get(
  "/bookings/:id/details",
  authMiddleware,
  requireRole("CLIENT"),
  bookingController.getBookingDetails
);

// Internal-only edit endpoint for admin tooling/services.
router.patch("/bookings/:id", internalAuth, bookingController.internalEditBooking);

export { router as bookingRouter };
