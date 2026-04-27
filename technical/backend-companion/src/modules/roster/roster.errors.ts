import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const rosterErrors = {
  // Raised when roster input validation fails.
  validationError: (message: string) => new AppError(ErrorCodes.VALIDATION_ERROR, message, 400),
  // Raised when a venue lookup fails.
  venueNotFound: () => new AppError(ErrorCodes.VENUE_NOT_FOUND, "Venue not found", 404),
  // Raised when a companion lookup fails.
  companionNotFound: () =>
    new AppError(ErrorCodes.COMPANION_NOT_FOUND, "Companion not found", 404),
  // Raised when a CAPTAIN+VICE_CAPTAIN pair cannot be reserved.
  noDuoAvailable: () => new AppError(ErrorCodes.NO_DUO_AVAILABLE, "No duo available", 409)
};
