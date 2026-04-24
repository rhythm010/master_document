import { AppError } from "../../shared/errors/appError";
import { ErrorCodes } from "../../shared/errors/errorCodes";

export const companionProfileErrors = {
  profileNotFound: () =>
    new AppError(ErrorCodes.COMPANION_PROFILE_NOT_FOUND, "Profile not found", 404),
  invalidLanguage: () =>
    new AppError(ErrorCodes.INVALID_LANGUAGE, "Invalid language", 400),
  validationError: (message: string) =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 400)
};
