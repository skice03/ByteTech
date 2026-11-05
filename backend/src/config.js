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
  return {
    port: port(env.PORT, 3000, 'PORT'),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    database: {
      host: env.DB_HOST ?? '127.0.0.1',
      port: port(env.DB_PORT, 3306, 'DB_PORT'),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      timezone: 'Z',
      connectionLimit: 5,
      connectTimeout: 5000
    }
  };
}
