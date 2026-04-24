import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";
import { verifyAuthToken } from "../utils/jwt";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Missing authorization", 401);
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid authorization", 401);
    }

    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (error) {
    next(error);
  }
}
