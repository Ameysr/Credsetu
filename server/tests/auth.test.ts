import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { TEST_OTP_MAX_ATTEMPTS } from './config';
import { authHeader, login } from './helpers/auth';
import { resetDatabase } from './helpers/db';

const PHONE = '+919876543210';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/request-otp', () => {
  it('generates a code, logs it, and returns 202', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const response = await request(app).post('/api/auth/request-otp').send({ phone: PHONE });

    expect(response.status).toBe(202);
    expect(response.body.devCode).toMatch(/^\d{6}$/);
    expect(response.body.expiresInSeconds).toBe(300);

    // The mock "SMS" is the server log.
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(response.body.devCode));

    const stored = await prisma.otpCode.findMany();
    expect(stored).toHaveLength(1);
  });

  it('never stores the code in plaintext', async () => {
    const response = await request(app).post('/api/auth/request-otp').send({ phone: PHONE });

    const stored = await prisma.otpCode.findFirstOrThrow();
    expect(stored.codeHash).not.toContain(response.body.devCode);
    expect(await bcrypt.compare(response.body.devCode, stored.codeHash)).toBe(true);
  });

  it('invalidates the previous code when a new one is requested', async () => {
    await request(app).post('/api/auth/request-otp').send({ phone: PHONE });
    await request(app).post('/api/auth/request-otp').send({ phone: PHONE });

    const active = await prisma.otpCode.count({ where: { consumedAt: null } });
    expect(active).toBe(1);
  });

  it.each([['not-a-phone'], ['123'], ['+0123456789'], ['']])(
    'rejects the invalid phone %p with 422',
    async (phone) => {
      const response = await request(app).post('/api/auth/request-otp').send({ phone });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.details[0].path).toBe('phone');
    },
  );
});

describe('POST /api/auth/verify-otp', () => {
  it('exchanges a valid code for a token and registers the user', async () => {
    const otpResponse = await request(app).post('/api/auth/request-otp').send({ phone: PHONE });

    const response = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: PHONE, code: otpResponse.body.devCode });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user.phone).toBe(PHONE);

    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
  });

  it('is idempotent for an existing phone number', async () => {
    const first = await login(app, PHONE);
    const second = await login(app, PHONE);

    expect(second.userId).toBe(first.userId);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a wrong code with 401 and does not create a user', async () => {
    const otpResponse = await request(app).post('/api/auth/request-otp').send({ phone: PHONE });
    const wrong = otpResponse.body.devCode === '000000' ? '111111' : '000000';

    const response = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: PHONE, code: wrong });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('OTP_INVALID');
    expect(await prisma.user.count()).toBe(0);
  });

  it('burns the code after too many wrong attempts', async () => {
    const otpResponse = await request(app).post('/api/auth/request-otp').send({ phone: PHONE });
    const { devCode } = otpResponse.body;
    const wrong = devCode === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < TEST_OTP_MAX_ATTEMPTS; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: PHONE, code: wrong });
      expect(response.status).toBe(401);
    }

    // Even the correct code is refused once the attempt budget is spent.
    const locked = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: PHONE, code: devCode });

    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');
  });

  it('cannot reuse a code that already logged in', async () => {
    const otpResponse = await request(app).post('/api/auth/request-otp').send({ phone: PHONE });
    const { devCode } = otpResponse.body;

    await request(app).post('/api/auth/verify-otp').send({ phone: PHONE, code: devCode });
    const replay = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: PHONE, code: devCode });

    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('OTP_NOT_FOUND');
  });

  it('reports an expired code distinctly', async () => {
    await prisma.otpCode.create({
      data: {
        phone: PHONE,
        codeHash: await bcrypt.hash('123456', 10),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: PHONE, code: '123456' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('OTP_EXPIRED');
  });

  it('rejects a malformed code with 422', async () => {
    const response = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: PHONE, code: 'abc' });

    expect(response.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const session = await login(app, PHONE);

    const response = await request(app).get('/api/auth/me').set(...authHeader(session));

    expect(response.status).toBe(200);
    expect(response.body.user.phone).toBe(PHONE);
  });

  it.each([
    ['no header', undefined],
    ['a malformed token', 'Bearer not-a-real-token'],
    ['the wrong scheme', 'Basic abc123'],
  ])('rejects %s with 401', async (_label, header) => {
    const requestBuilder = request(app).get('/api/auth/me');
    if (header) requestBuilder.set('Authorization', header);

    const response = await requestBuilder;

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
