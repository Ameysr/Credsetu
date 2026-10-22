import { Router } from 'express';
import { authRouter } from './auth.routes';
import { loanRouter } from './loan.routes';
import { summaryRouter } from './summary.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/loans', loanRouter);
apiRouter.use('/summary', summaryRouter);
