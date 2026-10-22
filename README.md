# MiniLedger

Track money you have lent to friends: who owes you, how much, and who is late.

Two packages in one repo:

| Folder    | What it is                                                |
| --------- | --------------------------------------------------------- |
| `server/` | Node + TypeScript + Express + Prisma + PostgreSQL API      |
| `app/`    | React Native app (Expo) for iOS and Android                |

---

## What it does

- **Phone login with a mock OTP.** The code is printed to the server log instead of being sent by SMS. No password, no signup step — a new number is registered on first login.
- **Add a loan entry.** Friend's name, amount and due date, with an optional note.
- **Mark it repaid.** Idempotent, so a double tap or a retried request is harmless.
- **Summary.** Total lent, total repaid and how much of it is overdue.
- **Overdue highlighting.** Overdue entries are tinted red in the list and called out in the summary card.
- **Receipt photos (bonus).** Attach a photo from the library to any entry.
- **Validation and tests (bonus).** Zod on every request; 48 Jest + Supertest tests covering auth, loans and summary.

---

## Prerequisites

- Node.js 20 or newer
- Docker Desktop (for the database)

## 1. Start the database

```bash
docker compose up -d
```

That brings up PostgreSQL 16 on **host port 5434** (plus Adminer at http://localhost:8080 if you started the whole stack).

> **Why 5434?** 5432 is usually taken by a locally installed PostgreSQL, and 5433 is used by Docker's own WSL relay on Windows. If you need a different port, set `POSTGRES_HOST_PORT` in a root `.env` file and mirror it in `server/.env`.

## 2. Run the API

```bash
cd server
cp .env.example .env      # Windows: copy .env.example .env
npm install
npx prisma migrate dev    # creates the tables
npm run db:seed           # optional: four demo entries
npm run dev
```

The API is now on http://localhost:4000. Check it with `curl http://localhost:4000/health`.

## 3. Run the app

```bash
cd app
npm install
npm start
```

Scan the QR code with **Expo Go**, or press `a` / `i` for an emulator.

Log in with the demo number `+919876543210` and the code printed in the server terminal. (With `DEV_RETURN_OTP=true` the code is also shown on the login screen, which is faster while developing.)

### How the app finds the API

You should not need to configure anything. Expo already knows your machine's LAN address because it is serving the JS bundle from there, and the app reuses that host with port 4000 (`app/src/config.ts`). Android emulators get `10.0.2.2` instead, since `localhost` inside an emulator is the emulator itself.

To point at something else:

```bash
EXPO_PUBLIC_API_URL=https://api.example.com npm start
```

---

## Tests

```bash
cd server
npm test          # 48 tests, Jest + Supertest
npm run typecheck
```

Tests run against a separate `miniledger_test` database (created by `docker/init-test-db.sql`), so they never touch your development data. Each test truncates the tables first, so order does not matter.

There is also an end-to-end check that talks to a **running** server over HTTP, which is the one to run before a demo:

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd server && npm run smoke     # 16 checks, creates and cleans up its own data
```

---

## API

Base path `/api`. Everything except the two auth endpoints needs `Authorization: Bearer <token>`.

| Method  | Path                       | Purpose                                              |
| ------- | -------------------------- | ---------------------------------------------------- |
| `POST`  | `/auth/request-otp`        | `{ phone }` → generates a code, logs it, `202`        |
| `POST`  | `/auth/verify-otp`         | `{ phone, code }` → `{ token, user }`                 |
| `GET`   | `/auth/me`                 | The signed-in user                                    |
| `POST`  | `/loans`                   | `{ friendName, amount, dueDate, note? }` → `201`      |
| `GET`   | `/loans?status=`           | `all` \| `outstanding` \| `repaid` \| `overdue`       |
| `PATCH` | `/loans/:id/repaid`        | Mark repaid (idempotent)                              |
| `POST`  | `/loans/:id/receipt`       | `multipart/form-data`, field `file`                   |
| `DELETE`| `/loans/:id`               | Delete an entry                                       |
| `GET`   | `/summary`                 | Totals and counts                                     |
| `GET`   | `/health`                  | Liveness                                              |

Full request/response examples: [docs/API.md](docs/API.md).

All errors share one shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Request validation failed",
             "details": [{ "location": "body", "path": "amount", "message": "..." }] } }
```

`401` unauthenticated · `404` not found or not yours · `422` invalid input · `429` too many OTP attempts.

---

## Design decisions

The reasoning behind the choices worth defending in a review is in
[docs/DESIGN.md](docs/DESIGN.md). The short version:

- **Money is stored as integers in minor units**, never floats. ₹500.50 is `50050`. `0.1 + 0.2 !== 0.3` in IEEE-754, and a ledger that is off by a paisa is worthless.
- **Overdue is computed, not stored.** It is `repaidAt === null && dueDate < today`, so it can never go stale and needs no nightly job.
- **OTPs are bcrypt-hashed, single-use, short-lived and attempt-limited.** The log line is the mock delivery channel, not the storage format.
- **"Outstanding" includes overdue.** Outstanding means "not yet repaid"; overdue is the subset past its due date. The summary keeps `lent = repaid + outstanding`.
- **A loan belonging to someone else returns 404, not 403**, so the API never reveals which ids exist.
- **`app.ts` is separate from `index.ts`** so tests can hand the Express app to Supertest without binding a port.

---

## Layout

```
.
├── docker-compose.yml         PostgreSQL 16 (+ Adminer)
├── docker/init-test-db.sql    creates miniledger_test
├── docs/
│   ├── API.md                 endpoint reference with curl examples
│   └── DESIGN.md              why the code is shaped this way
├── server/
│   ├── prisma/                schema, migration, seed
│   ├── src/
│   │   ├── app.ts             Express wiring (exported for tests)
│   │   ├── index.ts           listens, handles shutdown
│   │   ├── env.ts             validates config at boot
│   │   ├── errors.ts          AppError + helpers
│   │   ├── middleware/        auth, validate, error, loan ownership
│   │   ├── schemas/           Zod request schemas
│   │   ├── services/          otp, token, loan, summary, storage
│   │   ├── serializers/       database row → API shape
│   │   ├── routes/            auth, loans, summary
│   │   └── utils/             money, dates, async handler
│   ├── tests/                 3 suites + helpers
│   └── scripts/smoke.ts       end-to-end check against a live server
└── app/
    └── src/
        ├── api/               typed client + shared types
        ├── components/        SummaryCard, LoanListItem, form controls
        ├── context/           AuthContext (token + current user)
        ├── navigation/        RootNavigator
        ├── screens/           Login, Home, AddLoan
        ├── storage/           token persistence
        └── utils/             money and date formatting
```

---

## Troubleshooting

**`Cannot reach the server at http://192.168.x.x:4000`** — the phone and the computer must be on the same network, and the API must be running with the firewall allowing port 4000. As a fallback, set `EXPO_PUBLIC_API_URL` explicitly.

**`Bind for 0.0.0.0:5434 failed: port is already allocated`** — something else already uses that port. Pick another with `POSTGRES_HOST_PORT=5435 docker compose up -d` and update `DATABASE_URL` / `TEST_DATABASE_URL` in `server/.env`.

**Dev dependencies are being skipped on install** — if `NODE_ENV=production` is set in your shell, npm omits them. Run `npm install --include=dev`.

**No OTP in the log** — check `DEV_RETURN_OTP` and that you are looking at the terminal running `npm run dev`. The code is printed as `[otp] +91... -> 123456`.
