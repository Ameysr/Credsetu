import { Router } from 'express';
import { AppError } from '../errors';
import { currentUserId, requireAuth } from '../middleware/auth';
import { requireOwnedLoan } from '../middleware/require-owned-loan';
import { validate } from '../middleware/validate';
import {
  createLoanSchema,
  listLoansQuerySchema,
  loanIdParamSchema,
  type CreateLoanInput,
  type ListLoansQuery,
} from '../schemas/loan.schema';
import {
  attachReceipt,
  createLoan,
  deleteLoan,
  listLoans,
  markLoanRepaid,
} from '../services/loan.service';
import { receiptUrlFor, uploadReceipt } from '../services/storage.service';
import { asyncHandler } from '../utils/async-handler';

export const loanRouter = Router();

// Every loan route is scoped to the authenticated user.
loanRouter.use(requireAuth);

loanRouter.post(
  '/',
  validate({ body: createLoanSchema }),
  asyncHandler(async (req, res) => {
    const loan = await createLoan(currentUserId(req), req.body as CreateLoanInput);
    res.status(201).json({ loan });
  }),
);

loanRouter.get(
  '/',
  validate({ query: listLoansQuerySchema }),
  asyncHandler(async (req, res) => {
    const { status } = req.query as unknown as ListLoansQuery;
    res.json({ loans: await listLoans(currentUserId(req), status) });
  }),
);

loanRouter.patch(
  '/:id/repaid',
  validate({ params: loanIdParamSchema }),
  asyncHandler(async (req, res) => {
    const loan = await markLoanRepaid(String(req.params.id), currentUserId(req));
    res.json({ loan });
  }),
);

loanRouter.post(
  '/:id/receipt',
  validate({ params: loanIdParamSchema }),
  // Ownership is checked before multer runs, so we never store a file for a
  // loan the caller cannot see.
  requireOwnedLoan,
  uploadReceipt,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(422, 'FILE_REQUIRED', 'Attach an image under the "file" field');
    }

    const loan = await attachReceipt(String(req.params.id), currentUserId(req), receiptUrlFor(req.file));
    res.json({ loan });
  }),
);

loanRouter.delete(
  '/:id',
  validate({ params: loanIdParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteLoan(String(req.params.id), currentUserId(req));
    res.status(204).send();
  }),
);
