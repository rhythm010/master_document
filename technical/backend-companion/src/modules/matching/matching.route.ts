import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/requireRole";

import { matchingController } from "./matching.controller";

const router = Router();

// Get companion-companion matching context for the booking.
router.get(
  "/bookings/:bookingId/com-match/context",
  authMiddleware,
  requireRole("COMPANION"),
  matchingController.getComMatchContext
);

// Verify companion-companion matching via Captain QR/PIN.
router.post(
  "/bookings/:bookingId/com-match/verify",
  authMiddleware,
  requireRole("COMPANION"),
  matchingController.verifyComMatch
);

// Get matching context for the client or assigned companions.
router.get(
  "/bookings/:bookingId/matching/context",
  authMiddleware,
  matchingController.getMatchingContext
);

// Start client matching and begin location sharing.
router.post(
  "/bookings/:bookingId/client-match/start",
  authMiddleware,
  requireRole("CLIENT"),
  matchingController.startClientMatch
);

// Verify client-companion matching via client QR/PIN (Captain only).
router.post(
  "/bookings/:bookingId/client-match/verify",
  authMiddleware,
  requireRole("COMPANION"),
  matchingController.verifyClientMatch
);

// Update matching location for the client or companion.
router.post(
  "/bookings/:bookingId/matching/location",
  authMiddleware,
  matchingController.updateMatchingLocation
);

export { router as matchingRouter };
