// Reuses the app's client, which loads .env and validates the environment.
import { prisma } from '../src/db';

const DEMO_PHONE = '+919876543210';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setHours(12, 0, 0, 0);
  return date;
}

/**
 * A handful of loans in each state so the app has something to show the moment
 * it starts. Safe to re-run: it clears the demo user's loans first.
 */
async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { phone: DEMO_PHONE },
    update: {},
    create: { phone: DEMO_PHONE, name: 'Demo User' },
  });

  await prisma.loan.deleteMany({ where: { userId: user.id } });

  await prisma.loan.createMany({
    data: [
      {
        userId: user.id,
        friendName: 'Ravi',
        amountMinor: 50050,
        dueDate: daysFromNow(-5),
        note: 'Concert tickets',
      },
      {
        userId: user.id,
        friendName: 'Priya',
        amountMinor: 120000,
        dueDate: daysFromNow(10),
        note: 'Train booking',
      },
      {
        userId: user.id,
        friendName: 'Meera',
        amountMinor: 7525,
        dueDate: daysFromNow(2),
      },
      {
        userId: user.id,
        friendName: 'Arjun',
        amountMinor: 30000,
        dueDate: daysFromNow(-20),
        repaidAt: daysFromNow(-18),
        note: 'Settled already',
      },
    ],
  });

  const active = await prisma.otpCode.deleteMany({ where: { phone: DEMO_PHONE } });

  console.log(`Seeded ${DEMO_PHONE}`);
  console.log('  4 loans (1 overdue, 1 repaid), cleared');
  console.log(`  ${active.count} stale OTP row(s) removed`);
  console.log(`\n  Log in with phone ${DEMO_PHONE} and use the OTP printed by the server.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
