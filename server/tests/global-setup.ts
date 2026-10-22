import { execFileSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './config';

/**
 * Applies pending migrations to the test database once per run. Requires
 * Postgres to be up (`docker compose up -d`).
 */
export default function globalSetup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    shell: process.platform === 'win32',
  });
}
