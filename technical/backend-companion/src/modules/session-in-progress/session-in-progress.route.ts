import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/requireRole";

import { sessionInProgressController } from "./session-in-progress.controller";

const router = Router();

// Extend an active session by +1 hour (client owner only).
router.patch(
  "/bookings/:id/extend",
  authMiddleware,
  requireRole("CLIENT"),
  sessionInProgressController.extendBooking
);

// Trigger an SOS event (stub; no side effects).
router.post("/bookings/:id/sos", authMiddleware, sessionInProgressController.sosBooking);

// Return booking session metadata for the client or assigned companions.
router.get("/bookings/:id/session", authMiddleware, sessionInProgressController.getBookingSession);

// List captain↔vice session messages (companions only).
router.get(
  "/bookings/:id/messages",
  authMiddleware,
  requireRole("COMPANION"),
  sessionInProgressController.listBookingMessages
);

// Send a captain↔vice session message (companions only).
router.post(
  "/bookings/:id/messages",
  authMiddleware,
  requireRole("COMPANION"),
  sessionInProgressController.createBookingMessage
);

export { router as sessionInProgressRouter };
