import mysql from 'mysql2/promise';

export function createDatabase(config) {
  const pool = mysql.createPool(config);
  // UTC timestamps regardless of the MySQL host's timezone.
  pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
  return pool;
}
