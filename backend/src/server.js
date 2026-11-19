import { readConfig } from './config.js';
import { createDatabase } from './database.js';
import { createApp } from './app.js';

const config = readConfig();
const db = createDatabase(config.database);
const server = createApp({ db, corsOrigin: config.corsOrigin, sessionOptions: config.sessionOptions }).listen(config.port, () => {
  console.info(`ByteTech API listening on http://localhost:${config.port}/api/v1`);
});

server.on('error', async error => {
  console.error(`HTTP server failed: ${error.code}`);
  await db.end();
  process.exitCode = 1;
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await db.end();
    clearTimeout(timeout);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
