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
import { config } from "./shared/config";
import { errorHandler } from "./shared/middleware/errorHandler";

export const app = express();

const allowedOrigins = new Set(config.corsAllowedOrigins);

function isLocalDevOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  const isAllowedOrigin =
    !!origin &&
    (allowedOrigins.has(origin) || (config.nodeEnv !== "production" && isLocalDevOrigin(origin)));

  if (isAllowedOrigin && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-Internal-Api-Token"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

// Parse JSON bodies and URL-encoded payloads for API requests.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve uploaded files from the local uploads directory.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Simple health endpoint for uptime checks and local testing.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    appEnv: config.appEnv,
    verificationDeepLinkScheme: config.mobileDeepLinkScheme,
    emailDeliveryMode: config.emailDeliveryMode
  });
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
