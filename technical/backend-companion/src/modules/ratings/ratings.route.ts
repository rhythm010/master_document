import { Router } from "express";

import { authMiddleware } from "../../shared/middleware/auth";

import { ratingsController } from "./ratings.controller";

const router = Router();

// Create an immutable rating for the booking from the authenticated caller.
router.post("/bookings/:id/rating", authMiddleware, ratingsController.createBookingRating);

export { router as ratingsRouter };
