# ByteTech

ByteTech is a computer hardware and software store built with React, Express and MySQL. The project covers A1–A12 and plans to use Stripe in test mode. No bonus features are selected.

## Working prototype

- **A1 · Catalog.** Browse 34 seeded products in five categories, with product pages, images, RON prices and stock.
- **A2 · Search.** Search by product name and see when nothing matches.
- **A3 · Cart.** Add, update and remove items. The server checks stock and calculates the total. The cart persists after logout.
- **A4 · Accounts.** Register, log in, log out and save delivery addresses.

The week 7 materials include the [presentation slides](presentation/p2-slides.pdf) and the [project specification](presentation/p2-specification.pdf).

## Run locally

Use Node.js 24+ and a running MySQL 8.4+ database with a user that can create tables. [Database setup](backend/api.md#database-setup)

From the repository root, copy the configuration and set your MySQL credentials in `.env`.

```sh
cp -n .env.example .env
```

Run the one-time setup to install dependencies, migrate the database and seed the catalog.

```sh
npm run setup
```

Start the API and storefront in separate terminals.

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Open [ByteTech](http://localhost:5173). Choose **Log in → Create an account** for your first visit. Run the API tests with `npm --prefix backend test`.
