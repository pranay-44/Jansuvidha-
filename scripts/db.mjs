import mysql from 'mysql2/promise';

export function connectDatabase() {
  if (!process.env.MYSQL_DATABASE || !process.env.MYSQL_USER) throw Error('Configure MYSQL_DATABASE and MYSQL_USER in .env. See AUTH.md.');
  return mysql.createPool({host:process.env.MYSQL_HOST || '127.0.0.1', port:Number(process.env.MYSQL_PORT || 3306), user:process.env.MYSQL_USER, password:process.env.MYSQL_PASSWORD, database:process.env.MYSQL_DATABASE, connectionLimit:10, timezone:'Z', charset:'utf8mb4', ssl:process.env.MYSQL_TLS === 'true' ? {} : undefined});
}
export async function transaction(pool, work) {
  const db = await pool.getConnection();
  try { await db.beginTransaction(); const result = await work(db); await db.commit(); return result; }
  catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}
export async function rows(db, sql, values = []) { return (await db.execute(sql, values))[0]; }
