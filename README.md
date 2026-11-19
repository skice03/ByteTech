# ByteTech

ByteTech is an e-commerce project for computer hardware, software licenses and other tech products. The planned stack is React, Express, MySQL and Stripe in test mode.

The scope covers mandatory requirements A1–A12. No bonus features are selected.

## Implemented so far

- Database design and base API setup.
- **A4:** registration, login/logout and saved delivery addresses.
- **A3:** persistent shopping cart, server-calculated RON totals and stock checks.
- Account/cart validation, session protection and automated tests.

The React interface, catalog/search, checkout, payments, order history and administration are still planned.

## Run locally

Requires Node.js 24+ and MySQL 8.4+, with a database and user created. The current application starts the backend API.

From the `ByteTech` root, copy the example configuration:

```sh
cp -n .env.example .env
```

Set your MySQL credentials in `.env`, then run:

```sh
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run dev
```

Check the API at <http://localhost:3000/api/v1/health>.

Run tests with `npm --prefix backend test`. Database setup and endpoint details are in the [API reference](backend/api.md).
