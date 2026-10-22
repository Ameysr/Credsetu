import { app } from './app';
import { prisma } from './db';
import { env } from './env';

const server = app.listen(env.PORT, () => {
  console.log(`MiniLedger API listening on http://localhost:${env.PORT}`);
  if (env.DEV_RETURN_OTP) {
    console.log('DEV_RETURN_OTP=true — OTPs are logged here and echoed in the API response.');
  }
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`\n${signal} received — closing server`);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  // Don't hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
