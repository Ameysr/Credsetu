import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authHeader, daysFromNow, login, type TestSession } from './helpers/auth';
import { resetDatabase } from './helpers/db';

let session: TestSession;

beforeEach(async () => {
  await resetDatabase();
  session = await login(app, '+919876543210');
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createLoan(
  body: { friendName: string; amount: number | string; dueDate: string },
  as: TestSession = session,
): Promise<string> {
  const response = await request(app).post('/api/loans').set(...authHeader(as)).send(body);
  if (response.status !== 201) throw new Error(`Fixture failed: ${JSON.stringify(response.body)}`);
  return response.body.loan.id;
}

function getSummary(as: TestSession = session) {
  return request(app).get('/api/summary').set(...authHeader(as));
}

describe('GET /api/summary', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/summary')).status).toBe(401);
  });

  it('reports zeros for a user with no loans', async () => {
    const response = await getSummary();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      currency: 'INR',
      totals: { lentMinor: 0, repaidMinor: 0, outstandingMinor: 0, overdueMinor: 0 },
      counts: { total: 0, outstanding: 0, repaid: 0, overdue: 0 },
    });
  });

  it('splits lent, repaid and overdue amounts', async () => {
    const settled = await createLoan({ friendName: 'Repaid', amount: '500.50', dueDate: daysFromNow(-10) });
    await request(app).patch(`/api/loans/${settled}/repaid`).set(...authHeader(session));

    await createLoan({ friendName: 'Pending', amount: '200.00', dueDate: daysFromNow(5) });
    await createLoan({ friendName: 'Overdue', amount: '300.25', dueDate: daysFromNow(-2) });

    const response = await getSummary();

    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({
      lentMinor: 100075, // 500.50 + 200.00 + 300.25
      repaidMinor: 50050,
      outstandingMinor: 50025, // 200.00 + 300.25
      overdueMinor: 30025,
    });
    expect(response.body.counts).toEqual({ total: 3, outstanding: 2, repaid: 1, overdue: 1 });
  });

  it('keeps lent = repaid + outstanding', async () => {
    await createLoan({ friendName: 'A', amount: '19.99', dueDate: daysFromNow(-1) });
    const toSettle = await createLoan({ friendName: 'B', amount: '0.01', dueDate: daysFromNow(1) });
    await request(app).patch(`/api/loans/${toSettle}/repaid`).set(...authHeader(session));
    await createLoan({ friendName: 'C', amount: '1000', dueDate: daysFromNow(3) });

    const { totals } = (await getSummary()).body;

    expect(totals.lentMinor).toBe(1999 + 1 + 100000);
    expect(totals.lentMinor).toBe(totals.repaidMinor + totals.outstandingMinor);
  });

  it('drops a repaid entry out of the overdue amount', async () => {
    const id = await createLoan({ friendName: 'Late', amount: 500, dueDate: daysFromNow(-4) });
    expect((await getSummary()).body.totals.overdueMinor).toBe(50000);

    await request(app).patch(`/api/loans/${id}/repaid`).set(...authHeader(session));

    const after = await getSummary();
    expect(after.body.totals.overdueMinor).toBe(0);
    expect(after.body.totals.repaidMinor).toBe(50000);
    expect(after.body.counts.overdue).toBe(0);
  });

  it('only counts the caller\'s loans', async () => {
    await createLoan({ friendName: 'Mine', amount: 100, dueDate: daysFromNow(-1) });
    const other = await login(app, '+919000000009');
    await createLoan({ friendName: 'Theirs', amount: 9999, dueDate: daysFromNow(-1) }, other);

    expect((await getSummary()).body.totals.lentMinor).toBe(10000);
    expect((await getSummary(other)).body.totals.lentMinor).toBe(999900);
  });
});
