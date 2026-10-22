import { PrismaClient } from '@prisma/client';
// Importing env guarantees .env is loaded (and validated) before the client is
// constructed, instead of relying on whichever module happened to import it
// first. Prisma reads DATABASE_URL from process.env at connect time.
import { env, isProduction } from './env';

/**
 * A single PrismaClient for the process. Creating one per request exhausts the
 * connection pool under load.
 *
 * The instance is cached on globalThis so `tsx watch` reloads don't open a new
 * pool on every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
