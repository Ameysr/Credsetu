/** Shared test configuration. Kept dependency-free so both Jest hooks can use it. */

/**
 * Tests run against a separate database so `npm test` can never truncate the
 * development data. Created by docker/init-test-db.sql.
 *
 * Port 5434 matches docker-compose.yml, which publishes the container's 5432 on
 * 5434 so it does not collide with a locally installed PostgreSQL.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://miniledger:miniledger@localhost:5434/miniledger_test?schema=public';

/** Small enough to exercise the lockout path in a couple of requests. */
export const TEST_OTP_MAX_ATTEMPTS = 3;

export const TEST_UPLOAD_DIR = 'uploads-test';
