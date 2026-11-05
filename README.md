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

Currently includes the database design and basic API setup.

Use Node.js 24 or later. Run these commands from the `ByteTech` root:

```sh
cp -n .env.example .env
npm --prefix backend ci
npm --prefix backend run dev
```

The copy command preserves an existing `.env`. Set your local MySQL credentials in that file before starting the API. Check the running API at <http://localhost:3000/api/v1/health>.
