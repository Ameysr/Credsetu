/**
 * Runs before any test module (and therefore before `src/env.ts` is imported),
 * so these values are what the application sees. dotenv does not overwrite
 * variables that are already set, so a local .env won't clobber them.
 */
import { TEST_DATABASE_URL, TEST_OTP_MAX_ATTEMPTS, TEST_UPLOAD_DIR } from './config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'test-jwt-secret-long-enough-to-pass-validation';
process.env.OTP_MAX_ATTEMPTS = String(TEST_OTP_MAX_ATTEMPTS);
process.env.OTP_TTL_SECONDS = '300';
process.env.DEV_RETURN_OTP = 'true';
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
process.env.MAX_UPLOAD_BYTES = String(1024 * 1024);
