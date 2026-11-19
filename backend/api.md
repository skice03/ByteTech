# ByteTech API reference

The Express/MySQL API currently implements user accounts and saved addresses (A4) and a persistent shopping cart (A3). All amounts are in RON. Catalog/search, checkout, payments and administration remain planned.

## Database setup

Use Node.js 24+ and MySQL 8.4+. Start MySQL and create a development database and user using your MySQL administrator account:

```sql
CREATE DATABASE bytetech CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'bytetech'@'localhost' IDENTIFIED BY 'replace_with_your_local_password';
GRANT ALL PRIVILEGES ON bytetech.* TO 'bytetech'@'localhost';
```

Once the database exists, follow the [project README](../README.md#run-locally) to configure and start the API.

`.env` is local and ignored by Git. `.env.example` contains public example values, not live credentials. `CORS_ORIGIN` must be the exact frontend origin, normally `http://localhost:5173`, with no trailing slash. `SESSION_TTL_HOURS` defaults to 24 (allowed: 1–168); existing configuration files can omit it. `NODE_ENV=production` enables Secure cookies and requires HTTPS. An optional `DB_SOCKET` can select a local Unix socket instead of TCP.

The migration creates eight application tables from the agreed 15-table design: `users`, `user_sessions`, `user_addresses`, `user_address_links`, `categories`, `products`, `product_images`, and `cart_items`. The catalog tables let the cart reference real products; no catalog routes or seed products are supplied here. The remaining seven tables will be added with their respective features.

`_schema_migrations` is internal migration bookkeeping. Running `db:migrate` again skips applied files and checks their checksums. Add a new numbered SQL file for subsequent changes. MySQL DDL commits implicitly: if a migration partially fails, inspect the affected tables before retrying. This initial migration expects an empty application database; it does not convert a database manually created from the full design.

The API opens MySQL connections on demand. `/ready` checks connectivity, so run the migration before using account/cart endpoints even if readiness succeeds.

## API contract for React

Base URL: `http://localhost:3000/api/v1`. Requests and responses use JSON. User IDs come from the authenticated session, never request input. IDs and quantities are JSON numbers; money is a two-decimal JSON string in RON (`"12.99"`).

| Method | Path | Access | Request / response |
| --- | --- | --- | --- |
| GET | `/` | Public | API name/version. |
| GET | `/health` | Public | Server liveness. |
| GET | `/ready` | Public | MySQL connectivity; 503 if unavailable. |
| GET | `/auth/csrf` | Public or signed in | Sets a CSRF cookie; returns `{ csrfToken }`. |
| POST | `/auth/register` | Public + CSRF | `{ firstName, lastName, email, password }` → 201 `{ user }`. |
| POST | `/auth/login` | Public + CSRF | `{ email, password }` → `{ user, csrfToken }` and session cookies. |
| POST | `/auth/logout` | Signed in + CSRF | Send `{}` → 204, no response body. |
| GET | `/users/me` | Signed in | `{ user: { id, email, firstName, lastName, role } }`. |
| GET | `/addresses` | Signed in | `{ addresses: [...] }`, only the current user's saved addresses. |
| POST | `/addresses` | Signed in + CSRF | Address fields below → 201 `{ address }`. |
| GET | `/cart` | Signed in | `{ cart }`. |
| POST | `/cart/items` | Signed in + CSRF | `{ productId, quantity }` adds/increments → 201 `{ cart }`. |
| PATCH | `/cart/items/:productId` | Signed in + CSRF | `{ quantity }` sets the absolute quantity → `{ cart }`. |
| DELETE | `/cart/items/:productId` | Signed in + CSRF | No body needed; removes the line → `{ cart }`. Repeating is safe. |

Registration trims names, lowercases/trims email and always creates a customer. Passwords are 15–128 characters, are not trimmed, and are stored only as Argon2id hashes. Registration does not log in automatically. Login and registration each allow 20 attempts per IP per 15 minutes, using process-local rate-limit counters.

Sessions are random opaque tokens in HttpOnly, SameSite=Lax cookies. MySQL holds only session/CSRF hashes and a fixed expiry. Login rotates tokens, logout deletes the current session, and expiry requires login again. Cart/address records remain. Authenticated sessions survive API restarts. An anonymous CSRF challenge expires after 30 minutes and must be fetched again after an API restart.

Every frontend `fetch` must use `credentials: 'include'`. Fetch `/auth/csrf` first and keep the returned token in memory; send it as `X-CSRF-Token` on POST/PATCH/DELETE. Send `Content-Type: application/json` with JSON bodies. Browser requests must come from `CORS_ORIGIN`; command-line clients must send that `Origin` header explicitly. After login, replace the anonymous token with `csrfToken` from the login response. After a page reload, fetch `/auth/csrf` again. Do not read or store the session cookie in JavaScript.

```js
const base = 'http://localhost:3000/api/v1';
let { csrfToken } = await fetch(`${base}/auth/csrf`, {
  credentials: 'include'
}).then(response => response.json());

const response = await fetch(`${base}/auth/login`, {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ email, password }) // Values from the login form.
});
const result = await response.json();
if (response.ok) csrfToken = result.csrfToken;
// Check response.ok on every request and display result.error for failures.
```

Save an address using these fields:

```json
{
  "recipientName": "Example Customer",
  "phone": "+40 712 345 678",
  "addressLine": "Example Street 10, apartment 2",
  "city": "Bucharest",
  "region": "Bucharest",
  "postalCode": "010101"
}
```

Family accounts saving the same location share one `user_addresses` row. Each has its own `user_address_links` row with recipient/phone. Saving an already linked location updates only that user's contact; it never edits another family's address/contact. Responses include the physical address `id`. Arbitrary user IDs, address IDs, roles and other unsupported input fields are rejected.

A cart response looks like this:

```json
{
  "cart": {
    "items": [{
      "productId": 1, "name": "Example Keyboard", "imageUrl": "/images/keyboard.png",
      "unitPrice": "12.99", "quantity": 2, "lineTotal": "25.98",
      "stockQuantity": 10, "isAvailable": true
    }],
    "itemCount": 2, "total": "25.98", "currency": "RON"
  }
}
```

The server reads current product prices and calculates totals using decimal arithmetic. `itemCount` is the total quantity, not the number of distinct products. Adding an existing product increments its quantity; PATCH replaces it. Quantity must be a positive integer. Remove lines with DELETE. There is one cart row per user/product pair.

Adds/updates lock the product and cart row within a transaction and reject the resulting quantity if above stock. Inactive products/categories cannot be added or updated. If stock or availability changes later, GET preserves the saved line and returns `isAvailable: false` so the UI can display the problem. Cart operations do not reserve or decrease stock. Future A7 checkout must account for active reservations and implement payment/cancellation stock changes.

Errors use `{ error: "message", fields?: { ... } }`. Handle: 400 invalid input/JSON, 401 login required/invalid credentials, 403 invalid origin/CSRF, 404 missing product/cart line/route, 409 duplicate email/insufficient stock/unavailable product, 413 body over 100 KB, 415 incorrect content type, 429 too many attempts, 503 unavailable/unmigrated database, and generic 500. Protected responses use `Cache-Control: no-store`.

## Verification

From the root, `npm --prefix backend test` runs the account/cart tests without MySQL. These include hashing, session rotation/expiry, CSRF, shared-address privacy, persistence after logout, ownership, quantity checks and exact totals.

For real database checks, create a **separate empty database** ending in `_test` (for example `bytetech_week7_test`) and a test user with privileges only on that database. From `backend/`:

```sh
TEST_DB_DATABASE=bytetech_week7_test DB_USER=your_test_user DB_PASSWORD=your_test_password npm run test:integration
```

Set `DB_HOST`/`DB_PORT` or optional `DB_SOCKET` as needed. This command applies migrations to the test database and removes only its own uniquely named fixtures afterward; the schema remains. It refuses a missing/non-test database name. Its eight scenarios verify migration reruns, SQL persistence, concurrent shared-address saves, concurrent cart additions, transactions, foreign keys, unique/check constraints and user deletion. Test products are temporary fixtures, not the A1 catalog seed.

These checks cover A3/A4; A12's required payment-confirmation tests still belong to the later payment work.
