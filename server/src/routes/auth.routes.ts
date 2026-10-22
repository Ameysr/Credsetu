import { Router } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { unauthorized } from '../errors';
import { currentUserId, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  requestOtpSchema,
  verifyOtpSchema,
  type RequestOtpInput,
  type VerifyOtpInput,
} from '../schemas/auth.schema';
import { toUserDto } from '../serializers/loan.serializer';
import { issueOtp, verifyOtp } from '../services/otp.service';
import { signAuthToken } from '../services/token.service';
import { asyncHandler } from '../utils/async-handler';

export const authRouter = Router();

/**
 * Step 1 of login. The code is a mock: it is printed to the server log rather
 * than sent by SMS. `DEV_RETURN_OTP` also echoes it in the response so the
 * mobile app can be driven without tailing the log — off in production.
 */
authRouter.post(
  '/request-otp',
  validate({ body: requestOtpSchema }),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as RequestOtpInput;
    const { code, expiresAt, ttlSeconds } = await issueOtp(phone);

    console.log(`\n[otp] ${phone} -> ${code}  (valid for ${ttlSeconds}s)\n`);

    res.status(202).json({
      message: 'OTP generated',
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: ttlSeconds,
      ...(env.DEV_RETURN_OTP ? { devCode: code } : {}),
    });
  }),
);

/**
 * Step 2 of login. A first-time phone number is registered on the spot — there
 * is no separate signup, matching how most OTP apps behave.
 */
authRouter.post(
  '/verify-otp',
  validate({ body: verifyOtpSchema }),
  asyncHandler(async (req, res) => {
    const { phone, code } = req.body as VerifyOtpInput;

    await verifyOtp(phone, code);

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    res.json({ token: signAuthToken(user.id), user: toUserDto(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
    if (!user) throw unauthorized('Account no longer exists');

    res.json({ user: toUserDto(user) });
  }),
);
