import type { Request, Response, NextFunction } from "express";

import type { UserRole } from "../types/enums";
import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401));
      return;
    }

    if (req.user.role !== role) {
      next(new AppError(ErrorCodes.FORBIDDEN, "Forbidden", 403));
      return;
    }

    next();
  };
}
