import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const ratingsErrors = {
  // Raised when a booking lookup fails.
  bookingNotFound: () => new AppError(ErrorCodes.BOOKING_NOT_FOUND, "Booking not found", 404),
  // Raised when rating submission is not allowed for the booking state.
  invalidStateTransition: () =>
    new AppError(ErrorCodes.INVALID_STATE_TRANSITION, "Invalid state transition", 400),
  // Raised when the caller is authenticated but not allowed to rate this booking.
  forbidden: () => new AppError(ErrorCodes.FORBIDDEN, "Forbidden", 403),
  // Raised for malformed or missing input.
  validationError: (message: string) => new AppError(ErrorCodes.VALIDATION_ERROR, message, 400),
  // Raised when a data-integrity check fails inside a transactional workflow.
  internalError: (message: string) => new AppError(ErrorCodes.INTERNAL_ERROR, message, 500)
};
