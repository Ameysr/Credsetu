import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { currentUserId } from './auth';
import { getOwnedLoan } from '../services/loan.service';

/**
 * Loads `:id` and asserts it belongs to the caller, storing it on `res.locals`.
 *
 * Running this *before* the upload middleware means a request for someone
 * else's (or a nonexistent) loan is rejected before we write anything to disk.
 */
export const requireOwnedLoan: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    res.locals.loan = await getOwnedLoan(String(req.params.id), currentUserId(req));
    next();
  } catch (error) {
    next(error);
  }
};
