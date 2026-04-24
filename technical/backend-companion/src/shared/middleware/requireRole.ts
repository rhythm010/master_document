import type { Request, Response, NextFunction } from "express";

import type { UserRole } from "../types/enums";
import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";

// Enforce a specific role for a route.
export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Require auth middleware to populate req.user.
    if (!req.user) {
      next(new AppError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401));
      return;
    }

    // Reject users with a different role.
    if (req.user.role !== role) {
      next(new AppError(ErrorCodes.FORBIDDEN, "Forbidden", 403));
      return;
    }

    // Continue when role matches.
    next();
  };
}
