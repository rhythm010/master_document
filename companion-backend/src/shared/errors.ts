export type ErrorDetail = { field: string; message: string };

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: ErrorDetail[];
  data?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ErrorDetail[],
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.data = data;
  }
}

export class ValidationError extends AppError {
  constructor(details: ErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, data?: Record<string, unknown>) {
    super(409, code, message, undefined, data);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(403, 'FORBIDDEN', message);
  }
}
