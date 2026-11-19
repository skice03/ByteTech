# ByteTech

ByteTech is a computer hardware and software store built with React, Express and MySQL.

- **A1 · Catalog.** Browse 34 seeded products in five categories, with product pages, images, RON prices and stock.
- **A2 · Search.** Search by product name and see when nothing matches.
- **A3 · Cart.** Add, update and remove items. The server checks stock and calculates the total. The cart persists after logout.
- **A4 · Accounts.** Register, log in, log out and save delivery addresses.

## Run locally

Use Node.js 24+ with npm. Start MySQL 8.4+ and run the shell commands from the `ByteTech` repository root.

### First-time setup

If you need a database and user, open a MySQL administrator session (`mysql -u root -p`) and run this SQL. Replace `your_local_password` with your chosen password.

```sql
CREATE DATABASE bytetech CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'bytetech'@'localhost' IDENTIFIED BY 'your_local_password';
GRANT ALL PRIVILEGES ON bytetech.* TO 'bytetech'@'localhost';
```

Back in your shell (`exit` leaves the MySQL client), copy the configuration template.

```sh
cp -n .env.example .env
```

Set `DB_PASSWORD` in `.env` to your MySQL user's password. Adjust the other `DB_` values if your connection differs. Then install dependencies, create the tables and load the sample products.

```sh
npm run setup
```

### Start the app

Start the API in one terminal (port 3000).

```sh
npm --prefix backend run dev
```

Start the storefront in a second terminal and leave both running.

```sh
npm --prefix frontend run dev
```

Open [ByteTech](http://localhost:5173).
