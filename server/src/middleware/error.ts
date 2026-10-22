import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { isProduction } from '../env';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function logServerError(req: Request, error: unknown): void {
  console.error(
    `[error] ${req.method} ${req.originalUrl} ->`,
    error instanceof Error ? error.stack ?? error.message : error,
  );
}

/** Mounted last. Every error leaves the API in the same shape. */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const resolved = toErrorBody(error);

  // 5xx means we have a bug; log it with enough context to reproduce.
  if (resolved.status >= 500) {
    logServerError(req, error);
  }

  res.status(resolved.status).json({ error: resolved.error });
}

interface ResolvedError {
  status: number;
  error: ErrorBody['error'];
}

function toErrorBody(error: unknown): ResolvedError {
  if (error instanceof AppError) {
    return {
      status: error.status,
      error: { code: error.code, message: error.message, details: error.details },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 422,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      },
    };
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE' ? 'File is larger than the allowed size' : error.message;
    return { status: 422, error: { code: error.code, message } };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return {
        status: 409,
        error: { code: 'CONFLICT', message: 'A record with those values already exists' },
      };
    }
    if (error.code === 'P2025') {
      return { status: 404, error: { code: 'NOT_FOUND', message: 'Resource not found' } };
    }
  }

  // Body-parser throws a SyntaxError subclass for malformed JSON.
  if (error instanceof SyntaxError && 'body' in error) {
    return { status: 400, error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } };
  }

  return {
    status: 500,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Something went wrong' : String((error as Error)?.message ?? error),
    },
  };
}

/** Any request that matched no route. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
    },
  });
}

export type { ErrorBody, ResolvedError };
