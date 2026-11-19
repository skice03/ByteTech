# ByteTech API reference

The Express/MySQL API serves the catalog (A1), product-name search (A2), persistent carts (A3) and accounts with saved delivery addresses (A4). All amounts are in RON.

## Database setup

To create the MySQL database and user, configure `.env` and start the API, follow the [project README](../README.md#run-locally).

`.env` is local and ignored by Git. `.env.example` contains public example values, not live credentials. `CORS_ORIGIN` must be the exact frontend origin, normally `http://localhost:5173`, with no trailing slash. `SESSION_TTL_HOURS` defaults to 24 (allowed: 1–168); existing configuration files can omit it. `NODE_ENV=production` enables Secure cookies and requires HTTPS. An optional `DB_SOCKET` can select a local Unix socket instead of TCP.

The migration creates eight application tables from the agreed 15-table design: `users`, `user_sessions`, `user_addresses`, `user_address_links`, `categories`, `products`, `product_images`, and `cart_items`. Run `npm --prefix backend run db:seed` after the migration to load the A1 catalog from `backend/seed/catalog.js`. The seed matches categories and products by name, so running it again updates the same rows (and resets demo stock) instead of adding duplicates; product IDs, carts and any additional images are preserved. The remaining seven tables will be added with their respective features.

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
| GET | `/categories` | Public | `{ categories: [{ id, name, productCount }] }`, active categories by name. |
| GET | `/categories/:categoryId` | Public | `{ category: { id, name } }`; 404 if missing or inactive. |
| GET | `/products?categoryId=&page=` | Public | Both parameters optional → `{ products, pagination }`, 24 per page. |
| GET | `/products/search?q=&page=` | Public | A case-insensitive substring of the product name (1–200 characters). Uses the same pagination and visibility as the catalog. No matches gives 200 and an empty list. |
| GET | `/products/:productId` | Public | `{ product }` with description and all images; 404 if missing or inactive. |
| GET | `/cart` | Signed in | `{ cart }`. |
| POST | `/cart/items` | Signed in + CSRF | `{ productId, quantity }` adds/increments → 201 `{ cart }`. |
| PATCH | `/cart/items/:productId` | Signed in + CSRF | `{ quantity }` sets the absolute quantity → `{ cart }`. |
| DELETE | `/cart/items/:productId` | Signed in + CSRF | No body needed; removes the line → `{ cart }`. Repeating is safe. |

Registration trims names, lowercases/trims email and always creates a customer. Passwords are 15–128 characters, are not trimmed, and are stored only as Argon2id hashes. Registration does not log in automatically. Login and registration each allow 20 attempts per IP per 15 minutes, using process-local rate-limit counters.

Sessions are random opaque tokens in HttpOnly, SameSite=Lax cookies. MySQL holds only session/CSRF hashes and a fixed expiry. Login rotates tokens, logout deletes the current session, and expiry requires login again. Cart/address records remain. Authenticated sessions survive API restarts. An anonymous CSRF challenge expires after 30 minutes and must be fetched again after an API restart.

The storefront sends cookies with `credentials: 'include'`. Before each write it fetches `/auth/csrf` and sends the current token in `X-CSRF-Token`, including after login and page reloads. JSON bodies use `Content-Type: application/json`. Browser writes must come from `CORS_ORIGIN`. A command-line client must send that `Origin` explicitly and retain the cookies. The session cookie is HttpOnly.

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

A product list response looks like this. Lists show active products in active categories, ordered by ID. A page past the end returns an empty `products` array. Unknown query parameters, `page` values outside 1–10000 and malformed IDs return 400; an unknown or inactive `categoryId` returns 404.

```json
{
  "products": [{
    "id": 1, "name": "14\" Ultrabook, 16 GB RAM, 512 GB SSD", "price": "4299.00", "currency": "RON",
    "stockQuantity": 12, "isAvailable": true, "category": { "id": 1, "name": "Laptops" },
    "image": { "url": "/images/products/ultrabook-14.svg", "altText": "Illustration of the 14\" Ultrabook, 16 GB RAM, 512 GB SSD" }
  }],
  "pagination": { "page": 1, "pageSize": 24, "totalItems": 34, "totalPages": 2 }
}
```

`GET /products/:productId` returns the same fields plus `description` and an ordered `images` array of `{ url, altText }` in place of `image`. `isAvailable` is `stockQuantity > 0`. Image URLs are paths served by the React app.

Errors use `{ error: "message", fields?: { ... } }`. Handle: 400 invalid input/JSON, 401 login required/invalid credentials, 403 invalid origin/CSRF, 404 missing product/cart line/route, 409 duplicate email/insufficient stock/unavailable product, 413 body over 100 KB, 415 incorrect content type, 429 too many attempts, 503 unavailable/unmigrated database, and generic 500. Protected responses use `Cache-Control: no-store`.

## Verification

From the root, `npm --prefix backend test` covers catalog pagination, product-name search, account sessions, CSRF, shared-address privacy, cart ownership, stock limits and RON totals.

For real database checks, create a **separate empty database** ending in `_test` (for example `bytetech_week7_test`) and a test user with privileges only on that database. From `backend/`:

```sh
TEST_DB_DATABASE=bytetech_week7_test DB_USER=your_test_user DB_PASSWORD=your_test_password npm run test:integration
```

Set `DB_HOST`/`DB_PORT` or optional `DB_SOCKET` as needed. This command applies migrations to the test database and removes only its own uniquely named fixtures afterward; the schema remains. It refuses a missing/non-test database name. Its eight account/cart scenarios verify migration reruns, SQL persistence, concurrent shared-address saves, concurrent cart additions, transactions, foreign keys, unique/check constraints and user deletion. Those test products are temporary fixtures. The catalog scenarios run the A1 seed twice in the test database to confirm it creates no duplicates, then read the seeded categories, pages and product details through the API; the seeded catalog stays in the test database.

The current checks cover A1–A4. Payment confirmation tests are planned with the Stripe integration.
