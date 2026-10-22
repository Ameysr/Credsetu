import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiRouter } from './routes';
import { UPLOAD_DIR } from './services/storage.service';

/**
 * Builds the Express app without starting it. Keeping this separate from
 * `index.ts` lets the test suite hand the app straight to Supertest.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const origins = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins }));

  app.use(express.json({ limit: '1mb' }));

  // Receipt images. Missing files fall through to the JSON 404 handler.
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h', index: false }));

  // Opening the API in a browser lands here. Without it the first thing anyone
  // sees is a bare 404, which reads like the server is broken.
  app.get('/', (_req, res) => {
    res.json({
      name: 'MiniLedger API',
      status: 'ok',
      endpoints: { health: '/health', api: '/api' },
      docs: 'See docs/API.md',
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
