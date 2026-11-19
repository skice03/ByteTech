# ByteTech

ByteTech is an e-commerce project for computer hardware, software licenses and other tech products. The planned stack is React, Express, MySQL and Stripe in test mode.

The scope covers mandatory requirements A1–A12. No bonus features are selected.

## Implemented so far

- Database design and base API setup.
- **A4:** registration, login/logout and saved delivery addresses.
- **A3:** persistent shopping cart, server-calculated RON totals and stock checks.
- **A1:** repeatable catalog seed (34 products in five categories), public catalog API and React pages for the paginated product list (24 per page), each category and each product.
- Account/cart/catalog validation, session protection and automated tests.

Search, React login/cart, checkout, payments, order history and administration are still planned.

## Run locally

Requires Node.js 24+ and MySQL 8.4+, with a database and user created. The backend API and the React frontend run as two processes.

From the `ByteTech` root, copy the example configuration:

```sh
cp -n .env.example .env
```

Set your MySQL credentials in `.env`, then run:

```sh
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run dev
```

Check the API and its database connection at <http://localhost:3000/api/v1/ready>. In a second terminal, start the frontend:

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open the catalog at <http://localhost:5173>. `db:seed` can be run again at any time: it updates the demo products in place and resets their stock without creating duplicates.

Product images are original SVG illustrations made for this project, stored in `frontend/public/images/products/`. Product descriptions are original text.

Run tests with `npm --prefix backend test`. Database setup and endpoint details are in the [API reference](backend/api.md).
