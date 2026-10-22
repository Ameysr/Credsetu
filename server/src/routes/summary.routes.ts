import { Router } from 'express';
import { currentUserId, requireAuth } from '../middleware/auth';
import { getSummary } from '../services/summary.service';
import { asyncHandler } from '../utils/async-handler';

export const summaryRouter = Router();

summaryRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getSummary(currentUserId(req)));
  }),
);
