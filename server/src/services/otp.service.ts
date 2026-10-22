import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { env } from '../env';
import { AppError } from '../errors';

const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  // randomInt is drawn from the CSPRNG, unlike Math.random().
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface IssuedOtp {
  code: string;
  expiresAt: Date;
  ttlSeconds: number;
}

/**
 * Creates a fresh login code and invalidates any outstanding one for the same
 * phone, so only the most recent OTP can ever be used.
 *
 * The caller is responsible for delivering the code (here: printing it).
 */
export async function issueOtp(phone: string): Promise<IssuedOtp> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({ data: { phone, codeHash, expiresAt } }),
  ]);

  return { code, expiresAt, ttlSeconds: env.OTP_TTL_SECONDS };
}

/**
 * Checks a submitted code. Reasons for rejection are distinct so the app can
 * tell "ask for a new code" apart from "you typed it wrong", but they are all
 * deliberately vague about whether the phone number exists.
 */
export async function verifyOtp(phone: string, code: string): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new AppError(400, 'OTP_NOT_FOUND', 'No active code for this number. Request a new one.');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, 'OTP_EXPIRED', 'That code has expired. Request a new one.');
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    // Burn it on the first request that discovers the budget is spent.
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError(
      429,
      'OTP_TOO_MANY_ATTEMPTS',
      'Too many incorrect attempts. Request a new code.',
    );
  }

  const matches = await bcrypt.compare(code, record.codeHash);

  if (!matches) {
    // Record the failed attempt. The code stays alive but every further attempt
    // is refused by the guard above once the budget is spent — so a wrong code
    // always reads as "incorrect" (401) and exhaustion reads as "slow down"
    // (429) on the next call, which is easier for a client to handle.
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    throw new AppError(401, 'OTP_INVALID', 'Incorrect code');
  }

  // Single use: burn it even on success.
  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}
