# ByteTech

ByteTech is an e-commerce project for computer hardware, software licenses and other tech products.

## Stack:

* **Frontend:** React
* **Backend:** Express
* **Database:** MySQL
* **Payments:** Stripe (test mode)

## Team:

* Cipu Marinel (backend)
* Bancu Alexandru-Georgian (frontend)

Includes the database design, base API, user accounts with saved addresses (A4), and a persistent shopping cart (A3). The React interface and product catalog are still to be added.

Scope: mandatory requirements A1–A12; no bonus features selected.

Use Node.js 24 or later. Run these commands from the `ByteTech` root:

```sh
cp -n .env.example .env
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run dev
```

The copy command preserves an existing `.env`. Start MySQL 8.4 or later, create the database/user and set their credentials in `.env` before running the migration. Check the API at <http://localhost:3000/api/v1/health>.

Run `npm --prefix backend test` for the account/cart checks. Setup details, API examples and the P2 checklist are in [backend/README.md](backend/README.md).
