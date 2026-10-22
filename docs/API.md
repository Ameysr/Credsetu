# MiniLedger API

Base URL `http://localhost:4000`. All request and response bodies are JSON except
the receipt upload.

Authenticated endpoints need a bearer token:

```
Authorization: Bearer <token>
```

Errors always look like this:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [{ "location": "body", "path": "amount", "message": "Amount must be greater than zero" }]
  }
}
```

---

## Auth

### `POST /api/auth/request-otp`

Generates a 6-digit code for a phone number and **prints it to the server log**:

```
[otp] +919876543210 -> 123456  (valid for 300s)
```

Any previously issued code for that number is invalidated.

**Body**

```json
{ "phone": "+919876543210" }
```

Phone numbers accept 10–15 digits with an optional leading `+`; spaces, dashes and
brackets are stripped before validation.

**Response `202`**

```json
{
  "message": "OTP generated",
  "expiresAt": "2026-10-21T17:12:31.000Z",
  "expiresInSeconds": 300,
  "devCode": "123456"
}
```

`devCode` is only present when `DEV_RETURN_OTP=true` (the default for local
development). It exists so the app can be driven without tailing the log. Turn it
off outside development.

---

### `POST /api/auth/verify-otp`

Exchanges a code for a token. An unknown phone number is registered at this point,
so there is no separate signup.

**Body**

```json
{ "phone": "+919876543210", "code": "123456" }
```

**Response `200`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "…", "phone": "+919876543210", "name": null, "createdAt": "…" }
}
```

**Failures**

| Status | Code                    | Meaning                                        |
| ------ | ----------------------- | ---------------------------------------------- |
| `400`  | `OTP_NOT_FOUND`         | No active code — request a new one              |
| `400`  | `OTP_EXPIRED`           | The code timed out                              |
| `401`  | `OTP_INVALID`           | Wrong code (attempt counted)                    |
| `429`  | `OTP_TOO_MANY_ATTEMPTS` | Attempt budget spent; the code is now dead      |

A code is single-use: after a successful login it cannot be replayed.

---

### `GET /api/auth/me`

**Response `200`** — `{ "user": { … } }`

---

## Loans

Amounts are returned in **minor units** (`amountMinor`, integer paise/cents) and
in major units (`amount`) for convenience. Always treat `amountMinor` as the
source of truth.

A loan object:

```json
{
  "id": "6f1a1c2e-…",
  "friendName": "Asha",
  "amountMinor": 50050,
  "amount": 500.5,
  "currency": "INR",
  "dueDate": "2026-11-04T12:00:00.000Z",
  "repaidAt": null,
  "isRepaid": false,
  "isOverdue": false,
  "daysOverdue": 0,
  "receiptUrl": null,
  "note": "Concert tickets",
  "createdAt": "2026-10-21T17:00:00.000Z"
}
```

`isOverdue` and `daysOverdue` are derived on every response: an entry is overdue
when it has not been repaid and its due date is before today. A loan due **today**
is not overdue.

### `POST /api/loans`

**Body**

```json
{
  "friendName": "Asha",
  "amount": "500.50",
  "dueDate": "2026-11-04T12:00:00.000Z",
  "note": "Concert tickets"
}
```

- `friendName` — 1–100 characters, required
- `amount` — number or numeric string, greater than zero, at most 2 decimals
- `dueDate` — any date string `Date` can parse, required
- `note` — up to 500 characters, optional
- `currency` — 3-letter code, optional, defaults to `INR`

**Response `201`** — `{ "loan": { … } }`

### `GET /api/loans?status=all|outstanding|repaid|overdue`

Ordered by due date ascending (soonest first); repaid entries are newest first.

- `all` — every entry
- `outstanding` — not yet repaid (**includes overdue**)
- `repaid` — settled
- `overdue` — not repaid and past the due date

**Response `200`** — `{ "loans": [ … ] }`

### `PATCH /api/loans/:id/repaid`

Marks an entry repaid. Idempotent — repeating it keeps the original `repaidAt`,
so a retry after a dropped response cannot corrupt the data.

**Response `200`** — `{ "loan": { … } }`

### `POST /api/loans/:id/receipt`

`multipart/form-data` with a single field named `file`.

- JPEG, PNG, WebP, HEIC or HEIF, up to 5 MB
- Ownership is checked **before** the upload is accepted, so a file is never
  written for a loan the caller cannot see
- Uploading again replaces the previous receipt

**Response `200`** — `{ "loan": { … "receiptUrl": "/uploads/9f3c….jpg" } }`

Read it back at `GET /uploads/<file>`.

### `DELETE /api/loans/:id`

**Response `204`** — no body.

---

## Summary

### `GET /api/summary`

**Response `200`**

```json
{
  "currency": "INR",
  "totals": {
    "lentMinor": 100075,
    "repaidMinor": 50050,
    "outstandingMinor": 50025,
    "overdueMinor": 30025
  },
  "counts": { "total": 3, "outstanding": 2, "repaid": 1, "overdue": 1 },
  "generatedAt": "2026-10-21T17:00:00.000Z"
}
```

- `lentMinor` — everything ever lent, always equal to `repaidMinor + outstandingMinor`
- `outstandingMinor` — the unrepaid remainder, **including** anything overdue
- `overdueMinor` — the subset of outstanding that is past its due date

---

## Walkthrough

```bash
API=http://localhost:4000

# 1. Ask for a code, then read it from the server log
curl -s -X POST $API/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210"}'

# 2. Swap it for a token
TOKEN=$(curl -s -X POST $API/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210","code":"123456"}' | jq -r .token)

AUTH="Authorization: Bearer $TOKEN"
JSON="Content-Type: application/json"

# 3. One entry that is already late, one still to come
curl -s -X POST $API/api/loans -H "$AUTH" -H "$JSON" \
  -d '{"friendName":"Asha","amount":"300.25","dueDate":"2026-01-01T12:00:00.000Z"}'

curl -s -X POST $API/api/loans -H "$AUTH" -H "$JSON" \
  -d '{"friendName":"Ravi","amount":"200.00","dueDate":"2027-01-01T12:00:00.000Z"}'

# 4. Overdue only
curl -s "$API/api/loans?status=overdue" -H "$AUTH"

# 5. Repay the late one, then check the totals
curl -s -X PATCH "$API/api/loans/<id>/repaid" -H "$AUTH"
curl -s "$API/api/summary" -H "$AUTH"

# 6. Attach a receipt
curl -s -X POST "$API/api/loans/<id>/receipt" -H "$AUTH" -F "file=@receipt.jpg"
```

`npm run smoke` performs this whole sequence with assertions.
