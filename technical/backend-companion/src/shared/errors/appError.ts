import type { ErrorCode } from "./errorCodes";

export class AppError extends Error {
  statusCode: number;
  code: ErrorCode;

  // Wrap an error with a stable error code and HTTP status.
  constructor(code: ErrorCode, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}
