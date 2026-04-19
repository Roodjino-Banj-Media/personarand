// Thin compatibility shim — preserves the better-sqlite3 API shape but runs
// against Postgres (Supabase) via postgres.js. Callers must `await` the
// .all/.get/.run methods since Postgres is async. ? placeholders are
// auto-converted to $1,$2,... and named @params to $1,$2,... with ordered keys.

const { getSql } = require('./lib/db');

// Track inserts to auto-append RETURNING id for lastInsertRowid behavior.
function isInsert(sql) {
  return /^\s*insert\s+into/i.test(sql);
}

// Convert ? placeholders to $1,$2,...
// Also support @named placeholders by ordered-key substitution if params is an object.
function convertPlaceholders(sql, params) {
  if (!params) return { sql, values: [] };

  // Object with @named placeholders
  if (!Array.isArray(params) && typeof params === 'object') {
    const values = [];
    const converted = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, key) => {
      values.push(params[key]);
      return `$${values.length}`;
    });
    return { sql: converted, values };
  }

  // Array / positional
  const arr = Array.isArray(params) ? params : [params];
  let i = 0;
  const converted = sql.replace(/\?/g, () => {
    i += 1;
    return `$${i}`;
  });
  return { sql: converted, values: arr };
}

function makeStatement(sql) {
  return {
    async all(params) {
      const sqlClient = getSql();
      const { sql: s, values } = convertPlaceholders(sql, params);
      return await sqlClient.unsafe(s, values);
    },
    async get(params) {
      const rows = await this.all(params);
      return rows[0] || null;
    },
    async run(params) {
      const sqlClient = getSql();
      const insert = isInsert(sql);
      // Auto-append RETURNING id if it's an INSERT and caller didn't add one
      const hasReturning = /\breturning\b/i.test(sql);
      const finalSql = insert && !hasReturning ? `${sql.trimEnd().replace(/;$/, '')} RETURNING id` : sql;
      const { sql: s, values } = convertPlaceholders(finalSql, params);
      const result = await sqlClient.unsafe(s, values);
      const lastInsertRowid = result[0]?.id ?? null;
      return { changes: result.count ?? result.length, lastInsertRowid };
    },
    // for for-of iteration compatibility
    async *iterate(params) {
      const rows = await this.all(params);
      for (const r of rows) yield r;
    },
  };
}

// Pseudo-db object. `close()` is a no-op since the Postgres client is pooled.
const db = {
  prepare(sql) { return makeStatement(sql); },
  async exec(sql) {
    const sqlClient = getSql();
    return await sqlClient.unsafe(sql);
  },
  transaction(fn) {
    // Returns a function that wraps fn in BEGIN/COMMIT. Caller invokes with args.
    return async (...args) => {
      const sqlClient = getSql();
      return await sqlClient.begin(async (tx) => {
        // Swap in a transaction-bound prepare() so nested queries use tx
        const txDb = {
          prepare(innerSql) {
            return {
              async all(params) {
                const { sql: s, values } = convertPlaceholders(innerSql, params);
                return await tx.unsafe(s, values);
              },
              async get(params) {
                const rows = await this.all(params);
                return rows[0] || null;
              },
              async run(params) {
                const insert = isInsert(innerSql);
                const hasReturning = /\breturning\b/i.test(innerSql);
                const finalSql = insert && !hasReturning ? `${innerSql.trimEnd().replace(/;$/, '')} RETURNING id` : innerSql;
                const { sql: s, values } = convertPlaceholders(finalSql, params);
                const result = await tx.unsafe(s, values);
                return { changes: result.count ?? result.length, lastInsertRowid: result[0]?.id ?? null };
              },
            };
          },
        };
        // Temporarily monkey-patch db to be txDb inside the transaction body.
        // We can't actually do that cleanly across closures, so fn must accept db as arg.
        return await fn(txDb, ...args);
      });
    };
  },
  pragma() { /* no-op in Postgres */ },
  close() { /* pooled, no-op */ },
};

// Compat: previous code did `const db = openDb()` and then `db.prepare()`.
// We return the same pool-backed db instance each time.
function openDb() { return db; }

// Compat: initSchema is a no-op \u2014 Supabase users run migrations/001_init.sql manually.
function initSchema() {}

// Seed if empty — only calendar + baseline metrics + templates. Gracefully skips if already populated.
async function seedIfEmpty() {
  const result = { calendar: 0, baseline_metrics: 0, templates: 0, seeded: false };
  try {
    const { query } = require('./lib/db');
    const calCount = await query('SELECT COUNT(*) AS n FROM content_calendar');
    const calN = Number(calCount[0]?.n || 0);

    if (calN === 0) {
      const { CALENDAR_ITEMS } = require('./seed');
      for (const item of CALENDAR_ITEMS) {
        await query(
          `INSERT INTO content_calendar (week, day, title, description, content_type, platforms, funnel_layer, status)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'planned')`,
          [item.week, item.day, item.title, item.description, item.content_type, JSON.stringify(item.platforms), item.funnel_layer]
        );
        result.calendar += 1;
      }
      result.seeded = true;
    } else {
      result.calendar = calN;
    }

    const metCount = await query('SELECT COUNT(*) AS n FROM performance_metrics');
    if (Number(metCount[0]?.n || 0) === 0) {
      const { BASELINE_METRICS } = require('./seed');
      for (const m of BASELINE_METRICS) {
        await query(
          `INSERT INTO performance_metrics (week_start, platform, followers, posts_count, reach, engagement_total, notes)
           VALUES ('2026-04-06', $1, $2, $3, $4, $5, $6)`,
          [m.platform, m.followers, m.posts_count, m.reach, m.engagement_total, m.notes]
        );
        result.baseline_metrics += 1;
      }
      result.seeded = true;
    }

    const tmplCount = await query('SELECT COUNT(*) AS n FROM email_templates');
    if (Number(tmplCount[0]?.n || 0) === 0) {
      const { TEMPLATES } = require('./seedTemplates');
      for (const t of TEMPLATES) {
        await query(
          `INSERT INTO email_templates (name, category, subject_line, body, variables, best_for)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
          [t.name, t.category, t.subject_line, t.body, JSON.stringify(t.variables || []), t.best_for]
        );
        result.templates += 1;
      }
      result.seeded = true;
    }
  } catch (err) {
    console.error('[seed] failed:', err.message);
  }
  return result;
}

const DB_PATH = '<postgres>'; // compat for legacy imports

module.exports = { openDb, initSchema, seedIfEmpty, DB_PATH, db };
