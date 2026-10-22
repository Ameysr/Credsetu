import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';
import { unauthorized } from '../errors';

export interface AuthTokenPayload {
  /** Subject: the user id. */
  sub: string;
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AuthTokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw unauthorized('Malformed token');
    }

    return { sub: decoded.sub };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Token expired');
    }
    throw unauthorized('Invalid token');
  }
}
