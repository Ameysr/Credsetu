import { prisma } from '../db';
import { isLoanOverdue } from '../serializers/loan.serializer';

export interface SummaryDto {
  currency: string;
  totals: {
    /** Everything ever lent, repaid or not. */
    lentMinor: number;
    repaidMinor: number;
    /** Unrepaid remainder. `lentMinor === repaidMinor + outstandingMinor`. */
    outstandingMinor: number;
    /** The subset of outstanding that is past its due date. */
    overdueMinor: number;
  };
  counts: {
    total: number;
    outstanding: number;
    repaid: number;
    overdue: number;
  };
  generatedAt: string;
}

/**
 * Totals are computed over a single query of the columns involved, then reduced
 * in memory. That keeps the overdue rule in exactly one place (isLoanOverdue)
 * rather than duplicating the date comparison inside SQL, and it stays correct
 * if a user ever holds loans in more than one currency.
 */
export async function getSummary(userId: string, now = new Date()): Promise<SummaryDto> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    select: { amountMinor: true, repaidAt: true, dueDate: true, currency: true },
  });

  const summary: SummaryDto = {
    currency: loans[0]?.currency ?? 'INR',
    totals: { lentMinor: 0, repaidMinor: 0, outstandingMinor: 0, overdueMinor: 0 },
    counts: { total: 0, outstanding: 0, repaid: 0, overdue: 0 },
    generatedAt: now.toISOString(),
  };

  for (const loan of loans) {
    summary.counts.total += 1;
    summary.totals.lentMinor += loan.amountMinor;

    if (loan.repaidAt !== null) {
      summary.counts.repaid += 1;
      summary.totals.repaidMinor += loan.amountMinor;
      continue;
    }

    summary.counts.outstanding += 1;
    summary.totals.outstandingMinor += loan.amountMinor;

    if (isLoanOverdue(loan, now)) {
      summary.counts.overdue += 1;
      summary.totals.overdueMinor += loan.amountMinor;
    }
  }

  return summary;
}
