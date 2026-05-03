import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const matchingErrors = {
  // Raised when a booking lookup fails.
  bookingNotFound: () => new AppError(ErrorCodes.BOOKING_NOT_FOUND, "Booking not found", 404),
  // Raised when the caller is not authorized for the booking.
  forbidden: () => new AppError(ErrorCodes.FORBIDDEN, "Forbidden", 403),
  // Raised when the booking or assignment state is invalid for the operation.
  invalidState: () => new AppError(ErrorCodes.INVALID_STATE, "Invalid state", 400),
  // Raised when GPS permission is missing.
  gpsPermissionRequired: () =>
    new AppError(ErrorCodes.GPS_PERMISSION_REQUIRED, "GPS permission required", 400),
  // Raised when GPS is disabled on device.
  gpsDisabled: () => new AppError(ErrorCodes.GPS_DISABLED, "GPS disabled", 400),
  // Raised when latitude/longitude values are missing or invalid.
  invalidCoordinates: () => new AppError(ErrorCodes.INVALID_COORDINATES, "Invalid coordinates", 400),
  // Raised when the client is outside the venue radius.
  outsideVenueRadius: () =>
    new AppError(ErrorCodes.OUTSIDE_VENUE_RADIUS, "Outside venue radius", 400),
  // Raised when companions have not marked presence as arrived.
  presenceNotArrived: () =>
    new AppError(ErrorCodes.PRESENCE_NOT_ARRIVED, "Presence not arrived", 400),
  // Raised when companion self match has not completed.
  selfMatchIncomplete: () =>
    new AppError(ErrorCodes.SELF_MATCH_INCOMPLETE, "Self match incomplete", 400),
  // Raised when client tries to send locations before matching started.
  clientMatchNotStarted: () =>
    new AppError(ErrorCodes.CLIENT_MATCH_NOT_STARTED, "Client match not started", 400),
  // Raised when QR or PIN verification fails.
  invalidQrOrPin: () => new AppError(ErrorCodes.INVALID_QR_OR_PIN, "Invalid QR or PIN", 400),
  // Raised for unexpected matching failures.
  internalError: (message: string) => new AppError(ErrorCodes.INTERNAL_ERROR, message, 500)
};
