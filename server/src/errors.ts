/**
 * Every expected failure is an AppError so the central error handler can map it
 * to a status code without a pile of conditionals. Anything else that reaches
 * the handler is a bug and becomes a 500.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);

export const validationFailed = (details: unknown) =>
  new AppError(422, 'VALIDATION_FAILED', 'Request validation failed', details);
