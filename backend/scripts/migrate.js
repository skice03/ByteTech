import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { readConfig } from '../src/config.js';

export async function migrate(databaseConfig) {
  const { connectionLimit, ...options } = databaseConfig;
  // Multiple statements are enabled only for these trusted local migration files.
  const connection = await mysql.createConnection({ ...options, multipleStatements: true });
  const lockName = 'bytetech:migrate:' + createHash('sha256').update(options.database).digest('hex').slice(0, 32);
  let locked = false;
  try {
    await connection.query("SET time_zone = '+00:00'");
    const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 15) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Could not acquire the migration lock.');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS _schema_migrations (
      name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    const directory = new URL('../migrations/', import.meta.url);
    const files = (await readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [rows] = await connection.execute('SELECT checksum FROM _schema_migrations WHERE name = ?', [name]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Applied migration was modified: ${name}. Add a new migration instead.`);
        continue;
      }
      // MySQL DDL commits implicitly; inspect a partial failure before retrying.
      await connection.query(sql);
      await connection.execute('INSERT INTO _schema_migrations (name, checksum) VALUES (?, ?)', [name, checksum]);
      console.info(`Applied ${name}`);
    }
  } finally {
    try { if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]); }
    finally { await connection.end(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await migrate(readConfig().database);
    console.info('Database migrations are up to date.');
  } catch (error) {
    console.error(`Migration failed: ${error.code ?? error.message}`);
    process.exitCode = 1;
  }
}
