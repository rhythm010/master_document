import { Router } from "express";
import rateLimit from "express-rate-limit";

import { config } from "../../shared/config";
import { ErrorCodes } from "../../shared/errors/errorCodes";
import { authMiddleware } from "../../shared/middleware/auth";
import { identityController } from "./identity.controller";

const router = Router();

// Throttle login attempts to mitigate brute-force retries.
const loginLimiter = rateLimit({
  windowMs: config.loginRateLimitWindowMinutes * 60 * 1000,
  max: config.loginRateLimitMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  // Send a consistent JSON error response when throttled.
  handler: (_req, res) => {
    res
      .status(429)
      .json({ code: ErrorCodes.TOO_MANY_ATTEMPTS, message: "Too many attempts" });
  }
});

// Signup, verification, and login routes.
router.post("/auth/signup", identityController.signup);
router.get("/auth/verify-email", identityController.verifyEmail);
router.post("/auth/resend-verification", identityController.resendVerification);
router.post("/auth/login", loginLimiter, identityController.login);
// Authenticated user profile routes.
router.get("/users/me", authMiddleware, identityController.getMe);
router.patch("/users/me", authMiddleware, identityController.updateNickname);

export { router as identityRouter };
