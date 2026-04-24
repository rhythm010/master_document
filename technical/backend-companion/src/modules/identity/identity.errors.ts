import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const identityErrors = {
  // Raised when a signup attempts to reuse an existing email.
  emailAlreadyExists: () =>
    new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS, "Email already exists", 409),
  // Raised when a user lookup fails.
  userNotFound: () => new AppError(ErrorCodes.USER_NOT_FOUND, "User not found", 404),
  // Raised when re-verifying an already verified address.
  emailAlreadyVerified: () =>
    new AppError(ErrorCodes.EMAIL_ALREADY_VERIFIED, "Email already verified", 400),
  // Raised for incorrect login credentials.
  invalidCredentials: () =>
    new AppError(ErrorCodes.INVALID_CREDENTIALS, "Invalid credentials", 401),
  // Raised when attempting to log in before email verification.
  emailNotVerified: () =>
    new AppError(ErrorCodes.EMAIL_NOT_VERIFIED, "Email not verified", 403),
  // Raised when login rate limits are exceeded.
  tooManyAttempts: () =>
    new AppError(ErrorCodes.TOO_MANY_ATTEMPTS, "Too many attempts", 429)
};
