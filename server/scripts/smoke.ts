/**
 * End-to-end smoke test against a *running* server.
 *
 *   npm run dev        # terminal 1
 *   npm run smoke      # terminal 2
 *
 * Unlike the Jest suite (which imports the app directly against a test
 * database), this exercises the real HTTP surface and the real database, which
 * is what you want to check before a demo. Requires DEV_RETURN_OTP=true.
 */
const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';
const PHONE = process.env.SMOKE_PHONE ?? '+919812345678';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

let passed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
    return;
  }

  console.error(`  FAIL  ${label}`);
  if (detail !== undefined) console.error(`        ${JSON.stringify(detail)}`);
  process.exitCode = 1;
}

interface RequestOptions {
  token?: string;
  body?: unknown;
}

async function call<T>(method: string, path: string, options: RequestOptions = {}): Promise<{
  status: number;
  body: T;
}> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as T) : (undefined as T) };
}

async function main(): Promise<void> {
  console.log(`Smoke-testing ${BASE_URL}\n`);

  const health = await call<{ status: string }>('GET', '/health');
  check('health endpoint responds', health.status === 200 && health.body.status === 'ok', health.body);

  const otp = await call<{ devCode?: string }>('POST', '/api/auth/request-otp', { body: { phone: PHONE } });
  check('request-otp returns 202', otp.status === 202, otp.body);
  check(
    'OTP is returned for the demo (DEV_RETURN_OTP)',
    typeof otp.body.devCode === 'string',
    'Set DEV_RETURN_OTP=true in server/.env',
  );
  if (!otp.body.devCode) return;

  const auth = await call<{ token: string; user: { id: string } }>('POST', '/api/auth/verify-otp', {
    body: { phone: PHONE, code: otp.body.devCode },
  });
  check('verify-otp returns a token', auth.status === 200 && Boolean(auth.body.token), auth.body);
  const token = auth.body.token;
  if (!token) return;

  const badCode = await call('POST', '/api/auth/verify-otp', {
    body: { phone: PHONE, code: '000000' },
  });
  check('a reused code is rejected', badCode.status === 400 || badCode.status === 401, badCode.body);

  const overdue = await call<{ loan: { id: string; isOverdue: boolean; amountMinor: number } }>(
    'POST',
    '/api/loans',
    { token, body: { friendName: 'Smoke Overdue', amount: '300.25', dueDate: daysFromNow(-2) } },
  );
  check('creating a loan returns 201', overdue.status === 201, overdue.body);
  check('the amount is stored in minor units', overdue.body.loan?.amountMinor === 30025, overdue.body.loan);
  check('a past due date is flagged overdue', overdue.body.loan?.isOverdue === true, overdue.body.loan);

  const pending = await call<{ loan: { id: string } }>('POST', '/api/loans', {
    token,
    body: { friendName: 'Smoke Pending', amount: '200.00', dueDate: daysFromNow(5) },
  });
  check('a future due date is not overdue', pending.status === 201, pending.body);

  const invalid = await call('POST', '/api/loans', {
    token,
    body: { friendName: 'Bad', amount: -5, dueDate: daysFromNow(1) },
  });
  check('validation rejects a negative amount', invalid.status === 422, invalid.body);

  const unauthorised = await call('GET', '/api/loans');
  check('loan routes require a token', unauthorised.status === 401, unauthorised.body);

  const repaid = await call<{ loan: { isRepaid: boolean; isOverdue: boolean } }>(
    'PATCH',
    `/api/loans/${overdue.body.loan.id}/repaid`,
    { token },
  );
  check('marking repaid works', repaid.status === 200 && repaid.body.loan.isRepaid, repaid.body);
  check('a repaid loan is no longer overdue', repaid.body.loan?.isOverdue === false, repaid.body.loan);

  const summary = await call<{
    totals: { lentMinor: number; repaidMinor: number; outstandingMinor: number; overdueMinor: number };
    counts: { total: number; overdue: number };
  }>('GET', '/api/summary', { token });
  check('summary returns 200', summary.status === 200, summary.body);
  check(
    'lent equals repaid plus outstanding',
    summary.body.totals.lentMinor === summary.body.totals.repaidMinor + summary.body.totals.outstandingMinor,
    summary.body.totals,
  );
  check('no overdue amount remains', summary.body.totals.overdueMinor === 0, summary.body.totals);

  // Clean up the fixtures this run created.
  await call('DELETE', `/api/loans/${overdue.body.loan.id}`, { token });
  await call('DELETE', `/api/loans/${pending.body.loan.id}`, { token });

  console.log(`\n${process.exitCode ? 'FAILED' : 'OK'} — ${passed} checks passed`);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
