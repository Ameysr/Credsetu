import { z } from 'zod';

/**
 * `amountMinor` is a Postgres INTEGER (max 2,147,483,647 minor units), so an
 * amount above ~21.4 million would fail at the database. Reject it here with a
 * readable message instead of surfacing a Prisma error.
 */
const MAX_AMOUNT_MINOR = 2_147_483_647;

/**
 * The API takes a decimal amount ("500.50") but the ledger stores minor units.
 * Validating here means `toMinor()` only ever sees a sane, 2-decimal value.
 */
export const amountSchema = z
  .union([z.number(), z.string().trim().min(1, 'Amount is required')])
  .transform((value, ctx) => {
    const parsed = typeof value === 'string' ? Number(value) : value;
    const fail = (message: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    };

    if (typeof value === 'string' && value.trim() === '') return fail('Amount is required');
    if (!Number.isFinite(parsed)) return fail('Amount must be a number');
    if (parsed <= 0) return fail('Amount must be greater than zero');

    // Anything that isn't a whole number of minor units is a precision mistake,
    // e.g. 10.005 rupees cannot be represented.
    const minor = Math.round(parsed * 100);
    if (Math.abs(parsed * 100 - minor) > 1e-6) {
      return fail('Amount can have at most 2 decimals');
    }
    if (minor > MAX_AMOUNT_MINOR) {
      return fail('Amount is too large (max 21,474,836.47)');
    }

    return parsed;
  });

export const createLoanSchema = z.object({
  friendName: z.string().trim().min(1, 'Friend name is required').max(100, 'Name is too long'),
  amount: amountSchema,
  dueDate: z.coerce.date({
    errorMap: () => ({ message: 'Due date must be a valid date' }),
  }),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  note: z.string().trim().max(500, 'Note is too long').optional(),
});

export const loanIdParamSchema = z.object({
  id: z.string().uuid('Loan id must be a UUID'),
});

export const LOAN_STATUSES = ['all', 'outstanding', 'repaid', 'overdue'] as const;

export const listLoansQuerySchema = z.object({
  status: z.enum(LOAN_STATUSES).default('all'),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
