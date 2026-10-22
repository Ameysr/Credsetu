import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authHeader, daysFromNow, login, type TestSession } from './helpers/auth';
import { resetDatabase } from './helpers/db';
import { NOT_AN_IMAGE, TINY_PNG, TINY_PNG_FILENAME } from './helpers/fixtures';

let session: TestSession;

beforeEach(async () => {
  await resetDatabase();
  session = await login(app, '+919876543210');
});

afterAll(async () => {
  await prisma.$disconnect();
});

function createLoan(body: Record<string, unknown>) {
  return request(app).post('/api/loans').set(...authHeader(session)).send(body);
}

describe('POST /api/loans', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/loans').send({ friendName: 'Asha', amount: 10 });

    expect(response.status).toBe(401);
  });

  it('stores the amount in minor units', async () => {
    const response = await createLoan({
      friendName: 'Asha',
      amount: '500.50',
      dueDate: daysFromNow(7),
      note: 'Lunch',
    });

    expect(response.status).toBe(201);
    expect(response.body.loan).toMatchObject({
      friendName: 'Asha',
      amountMinor: 50050,
      amount: 500.5,
      currency: 'INR',
      isRepaid: false,
      isOverdue: false,
      daysOverdue: 0,
      note: 'Lunch',
    });
  });

  it('accepts an amount sent as a number', async () => {
    const response = await createLoan({ friendName: 'Asha', amount: 1200, dueDate: daysFromNow(1) });

    expect(response.status).toBe(201);
    expect(response.body.loan.amountMinor).toBe(120000);
  });

  it.each([
    ['a missing friend name', { amount: 100, dueDate: daysFromNow(1) }, 'friendName'],
    ['a blank friend name', { friendName: '   ', amount: 100, dueDate: daysFromNow(1) }, 'friendName'],
    ['a zero amount', { friendName: 'A', amount: 0, dueDate: daysFromNow(1) }, 'amount'],
    ['a negative amount', { friendName: 'A', amount: -50, dueDate: daysFromNow(1) }, 'amount'],
    ['a non-numeric amount', { friendName: 'A', amount: 'abc', dueDate: daysFromNow(1) }, 'amount'],
    ['three decimal places', { friendName: 'A', amount: 10.005, dueDate: daysFromNow(1) }, 'amount'],
    ['an invalid due date', { friendName: 'A', amount: 100, dueDate: 'not-a-date' }, 'dueDate'],
    ['a missing due date', { friendName: 'A', amount: 100 }, 'dueDate'],
  ])('rejects %s with 422', async (_label, body, expectedPath) => {
    const response = await createLoan(body as Record<string, unknown>);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.map((d: { path: string }) => d.path)).toContain(expectedPath);
  });
});

describe('GET /api/loans', () => {
  it('flags overdue entries and counts the days', async () => {
    await createLoan({ friendName: 'Late', amount: 300, dueDate: daysFromNow(-3) });
    await createLoan({ friendName: 'Due today', amount: 100, dueDate: daysFromNow(0) });
    await createLoan({ friendName: 'Later', amount: 200, dueDate: daysFromNow(5) });

    const response = await request(app).get('/api/loans').set(...authHeader(session));

    expect(response.status).toBe(200);
    const byName = Object.fromEntries(
      response.body.loans.map((loan: { friendName: string }) => [loan.friendName, loan]),
    );

    expect(byName.Late.isOverdue).toBe(true);
    expect(byName.Late.daysOverdue).toBe(3);
    // Due today is not yet overdue.
    expect(byName['Due today'].isOverdue).toBe(false);
    expect(byName.Later.isOverdue).toBe(false);
  });

  it('filters by status', async () => {
    await createLoan({ friendName: 'Overdue', amount: 100, dueDate: daysFromNow(-1) });
    await createLoan({ friendName: 'Pending', amount: 200, dueDate: daysFromNow(3) });
    const settled = await createLoan({ friendName: 'Settled', amount: 300, dueDate: daysFromNow(1) });
    await request(app).patch(`/api/loans/${settled.body.loan.id}/repaid`).set(...authHeader(session));

    const names = async (status: string): Promise<string[]> => {
      const response = await request(app).get(`/api/loans?status=${status}`).set(...authHeader(session));
      return (response.body.loans as Array<{ friendName: string }>).map((loan) => loan.friendName);
    };

    expect(await names('all')).toHaveLength(3);
    expect(await names('overdue')).toEqual(['Overdue']);
    // "Outstanding" means "not yet repaid", so it includes overdue entries.
    expect(await names('outstanding')).toEqual(['Overdue', 'Pending']);
    expect(await names('repaid')).toEqual(['Settled']);
  });

  it('rejects an unknown status', async () => {
    const response = await request(app).get('/api/loans?status=whatever').set(...authHeader(session));

    expect(response.status).toBe(422);
  });

  it('only returns the caller\'s loans', async () => {
    await createLoan({ friendName: 'Mine', amount: 100, dueDate: daysFromNow(1) });

    const other = await login(app, '+919000000001');
    const response = await request(app).get('/api/loans').set(...authHeader(other));

    expect(response.body.loans).toEqual([]);
  });
});

describe('PATCH /api/loans/:id/repaid', () => {
  it('marks a loan repaid and is idempotent', async () => {
    const created = await createLoan({ friendName: 'Asha', amount: 100, dueDate: daysFromNow(-1) });
    const id = created.body.loan.id;

    const first = await request(app).patch(`/api/loans/${id}/repaid`).set(...authHeader(session));
    expect(first.status).toBe(200);
    expect(first.body.loan.isRepaid).toBe(true);
    // Repaying clears the overdue flag.
    expect(first.body.loan.isOverdue).toBe(false);

    const second = await request(app).patch(`/api/loans/${id}/repaid`).set(...authHeader(session));
    expect(second.status).toBe(200);
    expect(second.body.loan.repaidAt).toBe(first.body.loan.repaidAt);
  });

  it('returns 404 for another user\'s loan', async () => {
    const created = await createLoan({ friendName: 'Asha', amount: 100, dueDate: daysFromNow(1) });
    const other = await login(app, '+919000000002');

    const response = await request(app)
      .patch(`/api/loans/${created.body.loan.id}/repaid`)
      .set(...authHeader(other));

    expect(response.status).toBe(404);
  });

  it('returns 404 for an unknown id and 422 for a malformed one', async () => {
    const unknown = await request(app)
      .patch('/api/loans/6f1a1c2e-0000-4000-8000-000000000000/repaid')
      .set(...authHeader(session));
    expect(unknown.status).toBe(404);

    const malformed = await request(app).patch('/api/loans/not-a-uuid/repaid').set(...authHeader(session));
    expect(malformed.status).toBe(422);
  });
});

describe('DELETE /api/loans/:id', () => {
  it('deletes an owned loan', async () => {
    const created = await createLoan({ friendName: 'Asha', amount: 100, dueDate: daysFromNow(1) });
    const id = created.body.loan.id;

    expect((await request(app).delete(`/api/loans/${id}`).set(...authHeader(session))).status).toBe(204);
    expect((await request(app).delete(`/api/loans/${id}`).set(...authHeader(session))).status).toBe(404);
  });
});

describe('POST /api/loans/:id/receipt', () => {
  async function createOne() {
    const created = await createLoan({ friendName: 'Asha', amount: 100, dueDate: daysFromNow(1) });
    return created.body.loan.id as string;
  }

  it('stores an image and serves it back over /uploads', async () => {
    const id = await createOne();

    const response = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set(...authHeader(session))
      .attach('file', TINY_PNG, { filename: TINY_PNG_FILENAME, contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.loan.receiptUrl).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

    const fetched = await request(app).get(response.body.loan.receiptUrl);
    expect(fetched.status).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/png');
  });

  it('replaces the receipt when uploaded again', async () => {
    const id = await createOne();
    const upload = () =>
      request(app)
        .post(`/api/loans/${id}/receipt`)
        .set(...authHeader(session))
        .attach('file', TINY_PNG, { filename: TINY_PNG_FILENAME, contentType: 'image/png' });

    const first = await upload();
    const second = await upload();

    expect(second.body.loan.receiptUrl).not.toBe(first.body.loan.receiptUrl);
  });

  it('rejects a request with no file', async () => {
    const id = await createOne();

    const response = await request(app).post(`/api/loans/${id}/receipt`).set(...authHeader(session));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FILE_REQUIRED');
  });

  it('rejects a non-image upload', async () => {
    const id = await createOne();

    const response = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set(...authHeader(session))
      .attach('file', NOT_AN_IMAGE, { filename: 'notes.txt', contentType: 'text/plain' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('refuses to store a file for another user\'s loan', async () => {
    const id = await createOne();
    const other = await login(app, '+919000000003');

    const response = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set(...authHeader(other))
      .attach('file', TINY_PNG, { filename: TINY_PNG_FILENAME, contentType: 'image/png' });

    expect(response.status).toBe(404);
  });
});
