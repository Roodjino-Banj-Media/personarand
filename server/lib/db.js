// Postgres client using postgres.js — pointed at Supabase's Postgres instance.
// Tagged-template style keeps our code close to the old better-sqlite3 shape,
// just async.

const postgres = require('postgres');

let sql = null;

function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Paste the Supabase connection string into .env.');
  sql = postgres(url, {
    // Supabase's connection pooler (6543) requires prepared statements disabled.
    // The "session" pooler (5432) is OK with them. We default to safe settings.
    prepare: false,
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {}, // suppress NOTICE spam
  });
  return sql;
}

// Helper: run a parameterised query, return rows.
// Usage: const rows = await query('SELECT * FROM foo WHERE id = $1', [id]);
async function query(text, params = []) {
  const s = getSql();
  return await s.unsafe(text, params);
}

// Helper: run a query expected to return exactly one row (or null).
async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

module.exports = { getSql, query, queryOne };
