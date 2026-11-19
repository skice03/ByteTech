# ByteTech backend

Marinel's week 4–5 backend work provides A4 (accounts and saved addresses) and A3 (persistent shopping cart), ready for Alexandru to connect to React. Catalog/search and their seed data belong to Alexandru. Checkout, payments, stock reservations and administration remain later tasks. Having a role field does not implement administrator access or A9.

## Run locally

Use Node.js 24+ and MySQL 8.4+. Start MySQL and create a development database and user using your MySQL administrator account:

```sql
CREATE DATABASE bytetech CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'bytetech'@'localhost' IDENTIFIED BY 'replace_with_your_local_password';
GRANT ALL PRIVILEGES ON bytetech.* TO 'bytetech'@'localhost';
```

From the repository root:

```sh
cp -n .env.example .env
# Set DB_USER, DB_PASSWORD and DB_DATABASE in .env to match your local MySQL.
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run dev
```

`.env` is local and ignored by Git. `.env.example` contains public example values, not live credentials. `CORS_ORIGIN` must be the exact frontend origin, normally `http://localhost:5173`, with no trailing slash. `SESSION_TTL_HOURS` defaults to 24 (allowed: 1–168); existing configuration files can omit it. `NODE_ENV=production` enables Secure cookies and requires HTTPS. An optional `DB_SOCKET` can select a local Unix socket instead of TCP.

The migration creates eight application tables from the agreed 15-table design: `users`, `user_sessions`, `user_addresses`, `user_address_links`, `categories`, `products`, `product_images`, and `cart_items`. The catalog tables let the cart reference real products; no catalog routes or seed products are supplied here. The remaining seven tables will be added with their respective features.

`_schema_migrations` is internal migration bookkeeping. Running `db:migrate` again skips applied files and checks their checksums. Add a new numbered SQL file for subsequent changes. MySQL DDL commits implicitly: if a migration partially fails, inspect the affected tables before retrying. This initial migration expects an empty application database; it does not convert a database manually created from the full design.

The API opens MySQL connections on demand. `/ready` checks connectivity, so run the migration before using account/cart endpoints even if readiness succeeds.

## Files

| Path | Purpose |
| --- | --- |
| `src/server.js` | Starts the HTTP server and closes the server/database on shutdown. |
| `src/app.js` | Wires CORS, JSON parsing, cookies, routes and safe JSON error responses. |
| `src/config.js` | Reads and validates environment settings. |
| `src/database.js` | MySQL pool, UTC connections and transaction helper. |
| `src/errors.js`, `src/validation.js` | Expected HTTP errors and shared input checks. |
| `src/accounts/routes.js` | Registration, login/logout, current user and saved-address endpoints. |
| `src/accounts/security.js` | Argon2id passwords, cookie sessions, expiry, token hashing, origin/CSRF checks. |
| `src/accounts/store.js` | Parameterized account, session and shared-address SQL. |
| `src/accounts/validation.js` | Allowed registration/login fields and delivery-address validation. |
| `src/cart/routes.js`, `src/cart/validation.js` | Cart endpoints and quantity/product-ID checks. |
| `src/cart/store.js` | Persistent cart SQL and transactional stock checks. |
| `src/cart/totals.js` | Exact decimal calculations and RON response formatting. |
| `migrations/`, `scripts/migrate.js` | Versioned SQL and the migration command. |
| `test/*.test.js`, `test/helpers.js` | Account/cart API checks using Express and in-memory stores, without MySQL. |
| `test/integration/week7.test.js` | The same API with real MySQL persistence, constraints and concurrent requests. |
| `package.json`, `package-lock.json` | Dependencies/commands and their locked installation versions. |

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

From the root, `npm --prefix backend test` runs 32 account/cart tests without MySQL. These include hashing, session rotation/expiry, CSRF, shared-address privacy, persistence after logout, ownership, quantity checks and exact totals.

For real database checks, create a **separate empty database** ending in `_test` (for example `bytetech_week7_test`) and a test user with privileges only on that database. From `backend/`:

```sh
TEST_DB_DATABASE=bytetech_week7_test DB_USER=your_test_user DB_PASSWORD=your_test_password npm run test:integration
```

Set `DB_HOST`/`DB_PORT` or optional `DB_SOCKET` as needed. This command applies migrations to the test database and removes only its own uniquely named fixtures afterward; the schema remains. It refuses a missing/non-test database name. Its eight scenarios verify migration reruns, SQL persistence, concurrent shared-address saves, concurrent cart additions, transactions, foreign keys, unique/check constraints and user deletion. Test products are temporary fixtures, not the A1 catalog seed.

These checks cover A3/A4; A12's required payment-confirmation tests still belong to the later payment work.

## P2 handoff and remaining work

| Plan | Backend status | What is still needed |
| --- | --- | --- |
| Week 4 — schema/base API and A4 | Data model, account API and shared saved addresses implemented. | Alexandru's A1 catalog API and seed (at least 30 products, four categories, image/price/stock for every product). |
| Week 5 — A3 | Persistent cart API, stock validation and server totals implemented. | Alexandru's A2 search and catalog work. |
| Week 6 — UI/prototype integration | Routes, cookie/CSRF flow, migration and integration guide ready. | Alexandru connects React registration/login/address/cart screens and the catalog to the backend. Run the assembled live prototype together. |
| Week 7 — P2 | ERD and relational-model PNGs available; backend demo steps below are supported. | Update/reconcile the architecture, API and critical-flow drafts; assemble wireframes, specification and slides; rehearse and tag the final commit `P2`. |

The three architecture/API/flow PNGs remain presentation drafts for Alexandru to update. They must match the 15-table design, shared-address links, grouped order products, the actual endpoint access rules, and the planned webhook/stock behavior. The critical flow describes future checkout/payment implementation; it is not runnable yet.

The review found these specific differences to resolve in those drafts:

- **API:** use the implemented `/api/v1` prefix, include CSRF-token and saved-address routes, and distinguish implemented endpoints from future ones. Profile editing, clearing the entire cart and listing all users are optional extras, not implemented requirements here.
- **Architecture:** the complete model has 15 application tables; the current migration implements eight. Reviews and review controllers are outside the agreed mandatory scope. Mark future components such as administrator authorization and payment handlers as planned.
- **Critical flow:** use the model's `new` order status, `reserved` reservation status and `cancelled` payment status, replacing `pending_payment`, `active` and `expired` respectively. Calculate reservation demand through `order_item_products`, aggregate quantities by product, and verify the expected payment IDs, amount and currency before applying order/stock changes once in a transaction.

Weeks 6–7 are shared team work in the plan. Alexandru supplies the catalog/frontend; Marinel still participates in testing the assembled frontend/backend, resolving integration issues, preparing the backend/data-model explanation and presenting it. Backend tests passing alone do not complete the joint P2 prototype or submission.

### Bonus scope

No bonus feature is selected or implemented. The current SQL schema and account/cart code support mandatory requirements only. The early planning presentation and the draft API/architecture images still mention advanced filtering/sorting (related to **B1**) and reviews (related to **B3**). These references are not evidence that either bonus is implemented or meets its acceptance criteria. Remove them from the P2 specification/diagrams to keep the agreed mandatory-only scope. No other B2 or B4–B7 features appear in the current source or schema.

The security checks and tests already added support A3/A4 and the later mandatory A10/A12 work; they are not bonuses. Shared family addresses and grouped order items follow the agreed data model and are not bonus requirements either.

P2 requires: an explanation of the planned implementation of **each A1–A12 requirement**, ERD, component architecture and API list (method/route/access), checkout → payment processor → webhook → order status → stock sequence, and wireframes for catalog/product/cart/checkout/admin. The live prototype must show a database-seeded catalog and login. Prepare slides of at most 15 pages and a specification PDF of at most 8 pages, then a repository commit tagged `P2`; submit at least 24 hours before the presentation. Do not mark P2 ready while the catalog/frontend or these documents are missing.

Suggested wording for Marinel's implemented requirements in the P2 slides/specification:

- **A4:** Customers register and log in using Argon2id-hashed passwords and revocable, expiring cookie sessions. Each account can save delivery addresses through its own links, allowing family members to share a location while keeping separate contact details.
- **A3:** The server stores each customer's cart in MySQL and calculates RON totals from current catalog prices. Adding, changing or removing products validates ownership and quantities, rejects amounts above stock, and preserves the cart after logout.

Backend demo sequence for the integrated UI:

1. Register a customer, log in and display `/users/me`.
2. Save a delivery address. Optionally demonstrate two family accounts sharing the location with different contact names.
3. From Alexandru's seeded catalog, add products, change quantities and show server-calculated RON totals.
4. Try a quantity above stock and display the 409 error.
5. Log out, log back in and show that the address and cart remain.

No P2 tag is created by this implementation. Finish the shared presentation/prototype first.
