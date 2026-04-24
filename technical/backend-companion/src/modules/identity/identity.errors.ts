import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const identityErrors = {
  emailAlreadyExists: () =>
    new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS, "Email already exists", 409),
  userNotFound: () => new AppError(ErrorCodes.USER_NOT_FOUND, "User not found", 404),
  emailAlreadyVerified: () =>
    new AppError(ErrorCodes.EMAIL_ALREADY_VERIFIED, "Email already verified", 400),
  invalidCredentials: () =>
    new AppError(ErrorCodes.INVALID_CREDENTIALS, "Invalid credentials", 401),
  emailNotVerified: () =>
    new AppError(ErrorCodes.EMAIL_NOT_VERIFIED, "Email not verified", 403),
  tooManyAttempts: () =>
    new AppError(ErrorCodes.TOO_MANY_ATTEMPTS, "Too many attempts", 429)
};
