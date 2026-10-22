# Design notes

Why the code is shaped the way it is. Everything here is a decision that could
reasonably have gone another way.

---

## Money is an integer

`Loan.amountMinor` is an `Int` holding paise (or cents). ₹500.50 is stored as
`50050` and nowhere in the system does a float hold an amount.

Floating point cannot represent most decimal fractions. In IEEE-754,
`0.1 + 0.2 === 0.30000000000000004`, and `19.99 * 100 === 1998.9999999999998`. In a
ledger, those errors accumulate silently and the numbers stop being trustworthy.

The decimal amount arrives from the client as a string, so the conversion avoids
float multiplication entirely where it matters:

```ts
export function toMinor(amount: number | string): number {
  const parsed = typeof amount === 'string' ? Number(amount) : amount;
  return Math.round(parsed * 10 ** MINOR_UNIT_EXPONENT);
}
```

`Math.round` cleans up the last bit of float noise (`500.50 * 100` is
`50050.00000000001`), and the Zod schema rejects anything that is not a whole
number of minor units before this is reached — `10.005` rupees cannot be
represented, so it is a `422` rather than a silently rounded value.

The API also returns `amount` in major units, because that is what a client wants
to render. It is a convenience, not the storage format.

**Related:** `amountMinor` is a Postgres `INTEGER`, so the ceiling is
2,147,483,647 minor units (≈ 21.4 million). The schema enforces that bound with a
readable message instead of letting a Prisma error escape.

---

## Overdue is computed, never stored

```ts
export function isLoanOverdue(loan: Pick<Loan, 'repaidAt' | 'dueDate'>, now = new Date()): boolean {
  return loan.repaidAt === null && loan.dueDate.getTime() < startOfToday(now).getTime();
}
```

A stored `is_overdue` column would have to be recomputed by a nightly job, and it
would be wrong for every entry at every moment between the due date passing and
the job running. A derived value is always correct and there is nothing to keep in
sync.

The comparison is against **the start of today**, so an entry due today is on time
— which is what a user expects, and avoids entries flipping to overdue at
midnight-and-one-second into their own due date.

`daysOverdue` counts calendar days, not elapsed hours, so "3 days overdue" does
not depend on what time of day you look at it.

---

## OTP handling

The assignment says the OTP is a mock and should be printed to the log. That is the
delivery channel only — the storage is still done properly:

- **Hashed with bcrypt.** The log line is intentional; storing the code in
  plaintext would mean a database leak hands over live login codes. A test asserts
  the stored hash does not contain the code.
- **Short-lived.** `OTP_TTL_SECONDS` (default 300) is checked on every attempt.
- **Single-use.** `consumedAt` is set on success, so a replayed code fails with
  `OTP_NOT_FOUND`.
- **Attempt-limited.** `OTP_MAX_ATTEMPTS` wrong tries and the code is burned.
  Wrong codes always return `401 OTP_INVALID`; the request *after* the budget is
  spent returns `429 OTP_TOO_MANY_ATTEMPTS`. Keeping exhaustion on the following
  call makes client handling simpler — a wrong code always means "wrong code".
- **Generated with `crypto.randomInt`,** not `Math.random`.
- **Requesting a new code invalidates the previous one,** inside a transaction, so
  there is never more than one live code per number.

`OtpCode` is deliberately *not* a foreign key to `User`: a code is issued before
the account exists, because login registers unknown numbers on the spot.

`DEV_RETURN_OTP` echoes the code in the response so the mobile app can be driven
without watching the server terminal. It defaults to `true` for local development
and should be `false` anywhere real.

---

## Authentication

A JWT (HS256, 7-day expiry) with the user id in `sub`. Stateless, so there is no
session store to run, and the app can hold it in the device keychain.

There is no refresh-token rotation. That is a deliberate simplification for this
scope: the blast radius of a 7-day token is acceptable here, and adding rotation
would mean a token table and a revocation path that this app does not otherwise
need. A production version would want both, plus revocation on logout.

The token is stored with `expo-secure-store` (iOS Keychain / Android Keystore)
rather than `AsyncStorage`, because it is a credential. On web the module has no
implementation, so there is a `localStorage` fallback — acceptable because web is a
development convenience here, not a shipping target.

---

## Loan ownership returns 404, not 403

```ts
const loan = await prisma.loan.findFirst({ where: { id, userId } });
if (!loan) throw notFound('Loan not found');
```

Distinguishing "exists but is not yours" (403) from "does not exist" (404) tells an
attacker which ids are real. Scoping the query by `userId` in the `WHERE` clause
means ownership is not a separate check that can be forgotten — it is part of how
the row is fetched.

For the receipt upload, ownership is checked in middleware that runs **before**
multer, so a request for someone else's loan is rejected before anything is written
to disk. That avoids orphaned files rather than cleaning them up afterwards.

---

## "Outstanding" includes "overdue"

The two are not mutually exclusive. Outstanding means "not yet repaid"; overdue is
the subset of that which is past its due date. The summary is built to match:

```
lentMinor === repaidMinor + outstandingMinor
overdueMinor <= outstandingMinor
```

A test asserts that invariant directly. The alternative — treating them as
disjoint buckets — reads fine in a UI but produces totals that do not add up, which
is worse in a ledger.

---

## Layering

```
routes → services → db
            ↓
      serializers
```

- **Routes** deal with HTTP: parse, call, set a status code. No business rules.
- **Services** hold the rules and are the only place that touches Prisma. They are
  plain functions, so they can be called from a test or a script without a request.
- **Serializers** convert database rows into the API shape. This is where
  `isOverdue` and `daysOverdue` get attached, and it is the one place that decides
  what a client sees — the `codeHash` on `OtpCode` can never leak by accident.
- **`middleware/validate.ts`** replaces the request parts with parsed, coerced,
  type-narrowed data, so handlers work with real types instead of `any`.
- **`app.ts` is separate from `index.ts`** so Supertest can exercise the app
  without binding a port.

`utils/money.ts` and `utils/dates.ts` have no dependencies and are unit-testable in
isolation.

---

## Errors

Everything expected is an `AppError` carrying a status and a stable machine-readable
`code`. One handler at the end of the stack converts that into the response shape;
anything that is *not* an `AppError` is a bug and becomes a `500`, with the stack
logged and the message redacted in production.

Because validation errors carry a `details` array with a `path` per field, the app
can map them straight back onto the form inputs (`AddLoanScreen` does exactly
this) instead of showing one lumped message.

---

## Why not X

**Sessions instead of JWT** — would need a session store; the token has to survive
an app restart either way.

**Store `outstanding` as a column** — it is derivable, and a derived column drifts.

**Sum in SQL** (`SUM(amountMinor) ... GROUP BY`) — the summary reduces in memory over
a single query of the four columns involved. That keeps the overdue rule in exactly
one function instead of duplicating the date comparison in SQL, and it stays correct
if a user ever holds more than one currency. At this scale the difference is
irrelevant; at a larger one this is the first thing to move into the database.

**A separate signup flow** — phone + OTP *is* the signup; asking for the same
number twice would be busywork.

---

## Tests

Jest + Supertest against the Express app, on a dedicated `miniledger_test`
database. Each test truncates the tables, so tests are independent and order does
not matter.

48 tests across three suites, chosen for behaviour rather than coverage:

- the full OTP lifecycle including expired, replayed and exhausted codes
- that the OTP is never stored in plaintext
- that amounts survive the decimal → minor-unit round trip
- overdue detection at the boundaries (yesterday, today, tomorrow)
- idempotent repayment preserving the original `repaidAt`
- cross-user isolation on every route, including the upload
- that `lent === repaid + outstanding` holds

`scripts/smoke.ts` is the complement: it runs the real HTTP surface against a real
server and a real database, which is what actually needs to work for a demo.
