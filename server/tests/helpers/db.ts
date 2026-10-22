import { prisma } from '../../src/db';

/**
 * Wipes every table between tests. TRUNCATE ... CASCADE is a single statement
 * and resets the tables regardless of foreign keys.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "loans", "otp_codes", "users" RESTART IDENTITY CASCADE');
}

/** Removes OTP rows so a test can prove the "no active code" path. */
export async function clearOtps(): Promise<void> {
  await prisma.otpCode.deleteMany();
}
