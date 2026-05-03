import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const sessionInProgressErrors = {
  // Raised when a booking lookup fails.
  bookingNotFound: () => new AppError(ErrorCodes.BOOKING_NOT_FOUND, "Booking not found", 404),
  // Raised when attempting an invalid booking state transition.
  invalidStateTransition: () =>
    new AppError(ErrorCodes.INVALID_STATE_TRANSITION, "Invalid state transition", 400),
  // Raised when a caller is authenticated but not allowed to act on the booking.
  forbidden: () => new AppError(ErrorCodes.FORBIDDEN, "Forbidden", 403),
  // Raised for malformed or missing input.
  validationError: (message: string) => new AppError(ErrorCodes.VALIDATION_ERROR, message, 400),
  // Raised when a data-integrity check fails inside a transactional workflow.
  internalError: (message: string) => new AppError(ErrorCodes.INTERNAL_ERROR, message, 500)
};
