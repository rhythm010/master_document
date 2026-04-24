import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import multer from "multer";

import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";
import { logger } from "../logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Application errors already include a status and code.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }

  // Zod validation errors map to a generic 400 response.
  if (err instanceof ZodError) {
    res.status(400).json({ code: ErrorCodes.VALIDATION_ERROR, message: "Invalid input" });
    return;
  }

  // Normalize Multer upload errors into a validation response.
  if (err instanceof multer.MulterError) {
    res.status(400).json({ code: ErrorCodes.VALIDATION_ERROR, message: err.message });
    return;
  }

  // Log unexpected failures and return a generic 500.
  logger.error({ err }, "unhandled error");
  res
    .status(500)
    .json({ code: ErrorCodes.INTERNAL_ERROR, message: "Internal server error" });
}
