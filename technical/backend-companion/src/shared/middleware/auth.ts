import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";
import { verifyAuthToken } from "../utils/jwt";

// Extract and verify the Bearer token, then attach the user to the request.
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // Require the Authorization header.
    const header = req.headers.authorization;
    if (!header) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Missing authorization", 401);
    }

    // Expect the Bearer scheme with a token value.
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid authorization", 401);
    }

    // Verify token and attach user context for downstream handlers.
    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (error) {
    next(error);
  }
}
