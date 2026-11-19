# ByteTech handoff for Alexandru

Start with **A1, the seeded catalog**. The Express API already handles accounts and carts. Once the catalog reads products from MySQL, the React catalog and login screen can use the same database and API for the week 7 demonstration. The agreed scope is the mandatory A1–A12 requirements.

## Start on your device

For a fresh checkout, clone the team repository and create your work branch from the shared baseline on `main`.

```sh
git clone https://github.com/skice03/ByteTech.git
cd ByteTech
git switch -c alexandru main
```

If your branch already exists on GitHub, use `git switch alexandru` after cloning to track it. In an existing checkout, commit any local changes, fetch with `git fetch origin`, switch to your own branch and run `git merge origin/main` to bring in the shared baseline. Marinel's working branch is `marinel`. Publish your own new branch with `git push -u origin alexandru` and merge completed features into `main` for the shared demo.

Install Node.js 24+ and start MySQL 8.4+ with an empty ByteTech database and a user who can create its tables. From the repository root run the commands below. After the first command, open `.env` and set the credentials for **your** database. The initial migration creates the application tables in that database.

```sh
cp -n .env.example .env
# Edit .env before continuing.
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run dev
```

Open `http://localhost:3000/api/v1/ready` to check MySQL connectivity. Use `http://localhost:5173` for the frontend, or change `CORS_ORIGIN` in the root `.env` to its exact origin and restart Express. Sample SQL for creating the database and user is in the [API reference](backend/api.md).

## What the repository contains

| Area | What it does and where to look |
| --- | --- |
| Data model | The [ERD](<docs/entity relationship diagram.png>) shows the entities and their relationships. The [relational model](<docs/relational model.png>) maps them to 15 tables, including the two linking tables for saved addresses and products in order-item groups. The five PNGs are the files shared under `docs/`. The course PDFs and editable DBML are local materials. |
| Database setup | [Migration 001](backend/migrations/001_accounts_and_cart.sql) creates eight application tables. Four support accounts and saved addresses, three hold categories, products and images, and one holds cart items. The migration runner records applied files in `_schema_migrations`. Add new numbered migrations for later schema changes. |
| Base API | Under [backend/src](backend/src), `server.js` starts Express, `config.js` reads environment settings, `database.js` manages MySQL connections and transactions, and `app.js` mounts routes under `/api/v1`. Package scripts and locked dependencies are under `backend/`. |
| A4 accounts | [accounts](backend/src/accounts) validates input, hashes passwords with Argon2id, and uses expiring sessions for login and logout. Family members can save the same physical location through separate `user_address_links` rows. Each person's recipient name and phone belong to their own link. |
| A3 cart | [cart](backend/src/cart) stores one row per user/product pair. Adding increments quantity, updating sets the new quantity, and deleting removes the line. The server reads current prices, calculates two-decimal RON totals and rejects quantities above stock. Logging out preserves the cart. Stock reservation begins at checkout in the later design. |
| Verification | Run `npm --prefix backend test` for the 32 account/cart checks. Eight additional [MySQL scenarios](backend/test/integration/week7.test.js) cover persistence, shared addresses, constraints and concurrent cart updates. Use a dedicated database ending in `_test` and the integration command in the [API reference](backend/api.md). Test products are temporary fixtures. The catalog needs its own seed script. |

## Alexandru's implementation sequence

1. **Week 4 · A1 catalog.** Write a repeatable seed script for at least **30 products in at least four categories**, each with an image, price and stock. Use original descriptions and appropriately licensed images. Insert categories first, then products, then `product_images` with `alt_text` and `sort_order`. Use existing columns and numeric IDs. Implement public catalog reads and React pages for the paginated list (**at most 24 per page**), each category and each product. The detail page shows name, description, price, images and availability.
2. **Week 5 · A2 search.** Search product names and show a clear empty result. Test a known product and a term with zero matches. Category browsing, pagination and product-name search cover the mandatory scope.
3. **Week 6 · Connect React.** Use the existing login endpoints. Fetch `GET /api/v1/auth/csrf` with `credentials: 'include'`, send the returned token in `X-CSRF-Token` with the login JSON and cookies, then keep the fresh token returned on login. Registration creates the account and login starts its session. Use `GET /api/v1/users/me` to show the signed-in customer after a refresh. For cart integration, send the real product ID and quantity and display the total returned by the server. Request fields, access levels and response examples are in the [API reference](backend/api.md).
4. **Rehearse together.** Start from the documented setup, apply the migration and catalog seed, open the catalog, show a product from the database and log in through React. This is the required live P2 demonstration. To demonstrate the cart as well, add two units, change the quantity, try a quantity above stock, then log out and back in to show the saved cart.

## Edits to the three P2 diagrams

Keep the existing layouts. Update the labels and endpoint list before including them in the slides and specification. The running API has 14 method/route pairs, comprising three base routes, seven account/address routes and four cart routes.

| Diagram | Edits before submission |
| --- | --- |
| [API endpoints](docs/ByteTech_API_Endpoints.png) | Use the ByteTech prefix `/api/v1`. Include public/session `GET /auth/csrf` and signed-in, owner-scoped `GET /addresses` and `POST /addresses`. Indicate CSRF on browser writes. Keep the implemented account and cart methods from the API reference. Remove review routes and advanced filter/brand/price/sort entries to match mandatory scope. Profile editing, clearing the whole cart and listing users are optional draft routes. Omit them or explicitly identify their planned status. Add the agreed catalog/search routes and revise the endpoint count after editing. |
| [Architecture](docs/ByteTech_Architecture.png) | Change the full application schema count from 14 to **15**. Eight application tables exist at this stage. Show saved-address handling and the `/api/v1` prefix. Remove the Reviews controller and product-page reviews. Distinguish the working Express/MySQL account/cart path from the planned catalog, React, Stripe and admin components until each is implemented. |
| [Critical flow](docs/ByteTech_Critical_Flow.png) | Preserve the checkout → Stripe → signed webhook → order → stock sequence. Use `new` for an unpaid order, `reserved` for a live reservation and `cancelled` for an expired payment attempt. Keep Stripe's event name `checkout.session.expired`. Write purchase snapshots to `order_item_products`, then sum quantities per product across reserved groups. On confirmed payment, verify the signature, paid state, provider IDs, amount and RON currency. Record the event and update the order and stock once in one transaction, including on retries. Show a failed payment leaving the order unpaid, release reservations on unpaid cancellation and restore previously deducted stock once on paid cancellation. |

The early presentation mentions advanced filtering and reviews. Those correspond to **B1 filtered search** and **B3 reviews and ratings**. State **“No bonus features selected”** in the final P2 materials.

## Shared P2 submission

- [ ] Write one or two sentences for **each A1–A12** describing how the team will implement it. Show the current implementation status separately.
- [ ] Include the ERD, component diagram, endpoint list with method/route/access, and corrected payment sequence in the presentation and specification.
- [ ] Prepare five wireframes covering catalog, product detail, cart, checkout and administration.
- [ ] Finish and rehearse the live database-backed catalog and login. Both members speak during the 10-minute presentation, followed by five minutes for questions.
- [ ] Assemble **at most 15 slides** and the team's **specification PDF of at most eight pages**. Check the course README declaration requirement before submission. Tag the final integrated commit `P2`, publish the tag and submit the PDF slides and repository link pointing to it at least **24 hours before the presentation**.

## After P2

| Week | Alexandru | Marinel |
| --- | --- | --- |
| 8 | **A5** · Checkout with a saved address, two differently priced delivery methods, summary and confirmation with order number. | **A6** · Stripe test payments and signed webhook confirmation. |
| 9 | **A8** · Customer order history showing date, products, total and status. | **A7** · Stock reservation, protection against selling the last unit twice and stock updates on payment/cancellation. |
| 10 | **A9** · Admin product/category management, image upload and order filtering/status changes. | **A10** · Complete server-side validation and authorization, including admin access. |
| 11 | **A11** · Verify all customer pages at 360 px. | **A12** · Extend the automated suite with payment-confirmation tests and a single command for the required tests. |

The remaining seven business tables in the design are `shipping_methods`, `orders`, `order_items`, `order_item_products`, `payments`, `payment_events` and `stock_reservations`. P2 needs their design and payment sequence. Implementation follows the later milestones above.

The team plan reserves week 12 for fixes, final review and the P3 demo. The milestone and deliverable sources are page 4 of *Team Setup and Planning* and section 3.2 of the course *Project Specification*.
