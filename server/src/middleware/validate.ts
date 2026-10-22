import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { validationFailed } from '../errors';

interface ValidationTargets {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Parses and *replaces* the given request parts with their validated values, so
 * handlers work with typed, coerced data (a query string "5" becomes a number,
 * unknown keys are stripped).
 */
export function validate(targets: ValidationTargets): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: Array<{ location: string; path: string; message: string }> = [];

    for (const location of ['params', 'query', 'body'] as const) {
      const schema = targets[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location]);

      if (!result.success) {
        issues.push(
          ...result.error.issues.map((issue) => ({
            location,
            path: issue.path.join('.') || '(root)',
            message: issue.message,
          })),
        );
        continue;
      }

      // req.query is a read-only getter in Express 5 / a plain object in 4.
      // Assigning via defineProperty works for both.
      Object.defineProperty(req, location, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    if (issues.length > 0) {
      next(validationFailed(issues));
      return;
    }

    next();
  };
}
