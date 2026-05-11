import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";

import { ratingsController } from "./ratings.controller";

const router = Router();

// Create an immutable rating for the booking from the authenticated caller.
router.post("/bookings/:id/rating", authMiddleware, ratingsController.createBookingRating);
// Return rating eligibility + submission status for a booking from the authenticated caller.
router.get("/bookings/:id/rating-status", authMiddleware, ratingsController.getBookingRatingStatus);

export { router as ratingsRouter };
