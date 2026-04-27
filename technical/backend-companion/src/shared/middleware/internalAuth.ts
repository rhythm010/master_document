import type { Request, Response, NextFunction } from "express";

import { config } from "../config";
import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";

// Authenticate internal service-to-service requests using a shared header token.
export function internalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.header("X-Internal-Token");
    if (!token || token !== config.internalApiToken) {
      throw new AppError(ErrorCodes.INTERNAL_UNAUTHORIZED, "Internal unauthorized", 401);
    }

    next();
  } catch (error) {
    next(error);
  }
}
