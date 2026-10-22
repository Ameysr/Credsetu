import type { Express } from 'express';
import request from 'supertest';

export interface TestSession {
  token: string;
  userId: string;
  phone: string;
}

/**
 * Walks the real login flow: request an OTP, read the code back from the
 * response (DEV_RETURN_OTP), then exchange it for a token.
 */
export async function login(app: Express, phone = '+919876543210'): Promise<TestSession> {
  const otpResponse = await request(app).post('/api/auth/request-otp').send({ phone });
  const code = otpResponse.body?.devCode;

  if (!code) {
    throw new Error(`No devCode in response: ${JSON.stringify(otpResponse.body)}`);
  }

  const verifyResponse = await request(app).post('/api/auth/verify-otp').send({ phone, code });

  if (!verifyResponse.body?.token) {
    throw new Error(`Login failed: ${JSON.stringify(verifyResponse.body)}`);
  }

  return {
    token: verifyResponse.body.token,
    userId: verifyResponse.body.user.id,
    phone,
  };
}

export function authHeader(session: TestSession): [string, string] {
  return ['Authorization', `Bearer ${session.token}`];
}

/** Tomorrow / yesterday as ISO strings, for due dates relative to today. */
export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
