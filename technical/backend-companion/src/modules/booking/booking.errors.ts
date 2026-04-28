import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const bookingErrors = {
  // Raised when a booking lookup fails.
  bookingNotFound: () => new AppError(ErrorCodes.BOOKING_NOT_FOUND, "Booking not found", 404),
  // Raised when a venue lookup fails.
  venueNotFound: () => new AppError(ErrorCodes.VENUE_NOT_FOUND, "Venue not found", 404),
  // Raised when a client attempts to create a second non-terminal booking.
  clientAlreadyHasNonTerminalBooking: () =>
    new AppError(
      ErrorCodes.CLIENT_ALREADY_HAS_NON_TERMINAL_BOOKING,
      "Client already has a non-terminal booking",
      409
    ),
  // Raised when attempting an invalid booking state transition.
  invalidStateTransition: () =>
    new AppError(ErrorCodes.INVALID_STATE_TRANSITION, "Invalid state transition", 400),
  // Raised when a companion attempts to cancel a booking they are not assigned to.
  companionNotAssigned: () =>
    new AppError(ErrorCodes.COMPANION_NOT_ASSIGNED, "Companion not assigned", 403),
  // Raised when a caller is authenticated but not allowed to act on the booking.
  forbidden: () => new AppError(ErrorCodes.FORBIDDEN, "Forbidden", 403),
  // Raised when timestamp parsing fails.
  invalidTimestamp: () => new AppError(ErrorCodes.VALIDATION_ERROR, "Invalid timestamp", 400)
};
