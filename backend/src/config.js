function port(value, fallback, name) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new Error(`${name} must be a port between 1 and 65535.`);
  }
  return number;
}

export function readConfig(env = process.env) {
  if (!env.DB_PASSWORD || !env.DB_USER || !env.DB_DATABASE) {
    throw new Error('Configure DB_USER, DB_PASSWORD and DB_DATABASE in the root .env file.');
  }
  const corsOrigin = env.CORS_ORIGIN ?? 'http://localhost:5173';
  let validOrigin = false;
  try { validOrigin = /^https?:\/\//.test(corsOrigin) && new URL(corsOrigin).origin === corsOrigin; } catch { /* Reject below. */ }
  if (!validOrigin) throw new Error('CORS_ORIGIN must be one HTTP origin, without a path or trailing slash.');
  const sessionTtlHours = Number(env.SESSION_TTL_HOURS ?? 24);
  if (!Number.isInteger(sessionTtlHours) || sessionTtlHours < 1 || sessionTtlHours > 168) {
    throw new Error('SESSION_TTL_HOURS must be between 1 and 168.');
  }
  return {
    port: port(env.PORT, 3000, 'PORT'),
    corsOrigin,
    sessionOptions: { sessionTtlHours, secureCookies: env.NODE_ENV === 'production' },
    database: {
      host: env.DB_HOST ?? '127.0.0.1',
      port: port(env.DB_PORT, 3306, 'DB_PORT'),
      ...(env.DB_SOCKET ? { socketPath: env.DB_SOCKET } : {}),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      timezone: 'Z',
      charset: 'utf8mb4',
      multipleStatements: false,
      connectionLimit: 5,
      connectTimeout: 5000
    }
  };
}
