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

// Extend an active session by +1 hour (client owner only).
router.patch(
  "/bookings/:id/extend",
  authMiddleware,
  requireRole("CLIENT"),
  bookingController.extendBooking
);

// Trigger an SOS event (stub; no side effects).
router.post("/bookings/:id/sos", authMiddleware, bookingController.sosBooking);

// Return booking session metadata for the client or assigned companions.
router.get("/bookings/:id/session", authMiddleware, bookingController.getBookingSession);

// List captain↔vice session messages (companions only).
router.get(
  "/bookings/:id/messages",
  authMiddleware,
  requireRole("COMPANION"),
  bookingController.listBookingMessages
);

// Send a captain↔vice session message (companions only).
router.post(
  "/bookings/:id/messages",
  authMiddleware,
  requireRole("COMPANION"),
  bookingController.createBookingMessage
);

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
