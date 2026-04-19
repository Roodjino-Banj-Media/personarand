// Local dev entry: imports app, seeds DB, listens on SERVER_PORT.
// Production (Vercel/etc.) uses api/index.js which imports app without listening.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = require('./app');
const { seedIfEmpty } = require('./db');

const PORT = Number(process.env.SERVER_PORT) || 3001;

(async () => {
  try {
    const result = await seedIfEmpty();
    console.log(`[boot] seeded: calendar=${result.calendar}, baseline_metrics=${result.baseline_metrics}, templates=${result.templates}`);
  } catch (err) {
    console.warn('[boot] seed skipped:', err.message);
  }

  // Start in-process scheduler for local dev
  try {
    require('./lib/scheduler').start();
  } catch (err) {
    console.warn('[boot] scheduler not started:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) console.warn('[server] WARNING: ANTHROPIC_API_KEY not set');
    if (!process.env.DATABASE_URL) console.warn('[server] WARNING: DATABASE_URL not set — Postgres queries will fail');
    if (!process.env.SUPABASE_URL) console.warn('[server] WARNING: SUPABASE_URL not set — auth + storage will fail');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] port ${PORT} is in use. Set SERVER_PORT in .env or free it.`);
      process.exit(1);
    }
    throw err;
  });
})();
