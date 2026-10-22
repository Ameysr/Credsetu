import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { unauthorized } from '../errors';
import { verifyAuthToken } from '../services/token.service';

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}

/**
 * Rejects the request unless a valid `Authorization: Bearer <jwt>` header is
 * present, then stashes the user id on the request for downstream handlers.
 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) throw unauthorized('Missing bearer token');

    req.userId = verifyAuthToken(token).sub;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Narrowing helper: route handlers call this instead of `req.userId!`, so the
 * "is the user authenticated?" check is enforced by the type system too.
 */
export function currentUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
