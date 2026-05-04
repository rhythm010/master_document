import express from "express";
import path from "path";
import process from "node:process";

import { identityRouter } from "./modules/identity";
import { companionProfileRouter } from "./modules/companion-profile";
import { rosterRouter } from "./modules/roster";
import { bookingRouter } from "./modules/booking";
import { sessionInProgressRouter } from "./modules/session-in-progress";
import { matchingRouter } from "./modules/matching";
import { ratingsRouter } from "./modules/ratings";
import { errorHandler } from "./shared/middleware/errorHandler";

export const app = express();

// Parse JSON bodies and URL-encoded payloads for API requests.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve uploaded files from the local uploads directory.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Simple health endpoint for uptime checks and local testing.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Register feature routers before the error handler.
app.use(identityRouter);
app.use(companionProfileRouter);
app.use(rosterRouter);
app.use(bookingRouter);
app.use(sessionInProgressRouter);
app.use(matchingRouter);
app.use(ratingsRouter);

// Centralized error handling for all routes.
app.use(errorHandler);
