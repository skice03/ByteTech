# Base API setup

The backend is a minimal Express scaffold with JSON parsing, CORS for the future React app, environment configuration, a MySQL connection pool, and basic JSON error responses.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1` | API name and version. |
| GET | `/api/v1/health` | Confirms that the Express server is running. |
| GET | `/api/v1/ready` | Runs `SELECT 1` to check MySQL connectivity; returns 503 when unavailable. |

The API starts without connecting to MySQL. Database connections are opened when needed. Readiness checks connectivity only, not whether any tables exist.

```text
backend/
  package.json       Start and development commands
  src/
    app.js           Express setup and health routes
    config.js        Environment configuration
    database.js      MySQL connection pool
    server.js        Server startup and shutdown
```

Copy the root `.env.example` to `.env` and configure your local MySQL credentials. Run `npm --prefix backend ci` and `npm --prefix backend run dev` from the repository root.

Example health response:

```json
{ "status": "ok" }
```

Unknown routes return 404. Malformed JSON returns 400, oversized JSON bodies return 413, and unexpected failures return a generic 500 response.

Application routes will be added when their tasks begin. No catalog, authentication, cart, checkout, payment or administration routes are implemented yet.
