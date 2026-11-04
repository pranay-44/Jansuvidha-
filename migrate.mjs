import {readFile} from 'node:fs/promises';
import {connectDatabase, rows} from './db.mjs';

export async function migrate(db) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(80) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const [lock] = await rows(db, "SELECT GET_LOCK('jansuvidha-migrations', 10) AS acquired");
  if (!lock.acquired) throw Error('Another migration is running.');
  try {
    for (const version of ['001-accounts','002-pilot-routing']) {
      if ((await rows(db, 'SELECT version FROM schema_migrations WHERE version=?', [version])).length) continue;
      const sql = await readFile(new URL(`./migrations/${version}.sql`, import.meta.url), 'utf8');
      for (const statement of sql.split(';').filter(s => s.trim())) await db.query(statement);
      await db.execute('INSERT INTO schema_migrations(version) VALUES (?)', [version]);
    }
  } finally { await db.query("SELECT RELEASE_LOCK('jansuvidha-migrations')"); }
}
if (process.argv[1]?.endsWith('migrate.mjs')) {
  const pool = connectDatabase(); const db = await pool.getConnection();
  try { await migrate(db); console.log('Non-destructive migrations applied.'); }
  finally { db.release(); await pool.end(); }
}
