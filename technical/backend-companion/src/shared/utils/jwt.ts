import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { z } from "zod";

import { config } from "../config";
import { AppError } from "../errors/appError";
import { ErrorCodes } from "../errors/errorCodes";
import type { UserRole } from "../types/enums";

const authTokenSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(["CLIENT", "COMPANION"]),
  email: z.string().email()
});

const emailVerifyTokenSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  purpose: z.literal("EMAIL_VERIFY")
});

export function signAuthToken(input: { sub: string; role: UserRole; email: string }) {
  return jwt.sign(input, config.jwtSecret, { expiresIn: config.authAccessTokenTtlSeconds });
}

export function signEmailVerifyToken(input: { sub: string; email: string }) {
  return jwt.sign(
    { ...input, purpose: "EMAIL_VERIFY" },
    config.jwtSecret,
    { expiresIn: config.emailVerifyTokenTtlSeconds }
  );
}

export function verifyAuthToken(token: string) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return authTokenSchema.parse(decoded);
  } catch (error) {
    throw mapJwtError(error);
  }
}

export function verifyEmailVerifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return emailVerifyTokenSchema.parse(decoded);
  } catch (error) {
    throw mapJwtError(error);
  }
}

function mapJwtError(error: unknown) {
  if (error instanceof TokenExpiredError) {
    return new AppError(ErrorCodes.TOKEN_EXPIRED, "Token expired", 401);
  }

  if (error instanceof JsonWebTokenError) {
    return new AppError(ErrorCodes.TOKEN_INVALID, "Invalid token", 401);
  }

  return new AppError(ErrorCodes.TOKEN_INVALID, "Invalid token", 401);
}
