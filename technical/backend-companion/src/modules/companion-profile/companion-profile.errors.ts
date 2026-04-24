import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const companionProfileErrors = {
  // Raised when a companion profile lookup fails.
  profileNotFound: () =>
    new AppError(ErrorCodes.COMPANION_PROFILE_NOT_FOUND, "Profile not found", 404),
  // Raised when a profile language value is not allowed.
  invalidLanguage: () =>
    new AppError(ErrorCodes.INVALID_LANGUAGE, "Invalid language", 400),
  // Raised for malformed or missing input.
  validationError: (message: string) =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 400)
};
