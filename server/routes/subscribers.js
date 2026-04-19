const express = require('express');
const { v4: uuid } = require('uuid');
const { openDb } = require('../db');

const router = express.Router();

// Computed engagement score using EXTRACT instead of julianday
const SCORE_SQL = `
  CAST(
    LEAST(50, COALESCE(s.total_opens, 0) * 10) +
    LEAST(25, COALESCE(s.total_clicks, 0) * 5) +
    (CASE
      WHEN s.last_engagement_at IS NULL THEN 0
      WHEN EXTRACT(EPOCH FROM (NOW() - s.last_engagement_at))/86400 > 60 THEN -20
      WHEN EXTRACT(EPOCH FROM (NOW() - s.last_engagement_at))/86400 > 30 THEN -5
      ELSE 0
    END) AS INTEGER
  )
`;

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { status, tag, source, min_engagement, q } = req.query;
    const clauses = [];
    const params = {};
    if (status) { clauses.push('s.status = @status'); params.status = status; }
    if (source) { clauses.push('s.source = @source'); params.source = source; }
    if (q) {
      clauses.push('(s.email ILIKE @q OR s.name ILIKE @q OR s.company ILIKE @q)');
      params.q = `%${q}%`;
    }
    if (tag) { clauses.push('s.tags::text ILIKE @tag'); params.tag = `%"${tag}"%`; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    let rows = await db.prepare(`
      SELECT s.*, ${SCORE_SQL} AS computed_engagement
      FROM newsletter_subscribers s ${where}
      ORDER BY s.subscribed_at DESC
    `).all(params);

    if (min_engagement) {
      const min = Number(min_engagement);
      rows = rows.filter((r) => (r.computed_engagement || 0) >= min);
    }
    res.json(rows.map((r) => ({ ...r, tags: normalizeArray(r.tags) })));
  } catch (e) { next(e); }
});

router.get('/facets', async (req, res, next) => {
  try {
    const db = openDb();
    const sources = (await db.prepare(`SELECT DISTINCT source FROM newsletter_subscribers WHERE source IS NOT NULL ORDER BY source`).all()).map((r) => r.source);
    const rows = await db.prepare(`SELECT tags FROM newsletter_subscribers WHERE tags IS NOT NULL`).all();
    const tagSet = new Set();
    for (const r of rows) for (const t of normalizeArray(r.tags)) tagSet.add(t);
    const statusCounts = await db.prepare(`SELECT status, COUNT(*) AS n FROM newsletter_subscribers GROUP BY status`).all();
    res.json({ sources, tags: [...tagSet].sort(), status_counts: statusCounts.map((r) => ({ status: r.status, n: Number(r.n) })) });
  } catch (e) { next(e); }
});

router.get('/overview', async (req, res, next) => {
  try {
    const db = openDb();
    const total = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'active'`).get()).n);
    const newThisWeek = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE subscribed_at >= NOW() - INTERVAL '7 days' AND status = 'active'`).get()).n);
    const newThisMonth = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE subscribed_at >= NOW() - INTERVAL '30 days' AND status = 'active'`).get()).n);
    const unsubs = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'unsubscribed'`).get()).n);
    res.json({ total, new_this_week: newThisWeek, new_this_month: newThisMonth, unsubscribed: unsubs });
  } catch (e) { next(e); }
});

router.get('/engagement-leaders', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT s.*, ${SCORE_SQL} AS computed_engagement
      FROM newsletter_subscribers s
      WHERE s.status = 'active'
      ORDER BY computed_engagement DESC, s.total_opens DESC
      LIMIT 20
    `).all();
    res.json(rows.map((r) => ({ ...r, tags: normalizeArray(r.tags) })));
  } catch (e) { next(e); }
});

router.get('/needs-reengagement', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT s.*, ${SCORE_SQL} AS computed_engagement
      FROM newsletter_subscribers s
      WHERE s.status = 'active'
        AND (s.last_engagement_at IS NULL OR EXTRACT(EPOCH FROM (NOW() - s.last_engagement_at))/86400 > 30)
      ORDER BY s.subscribed_at ASC
      LIMIT 50
    `).all();
    res.json(rows.map((r) => ({ ...r, tags: normalizeArray(r.tags) })));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { email, name, company, title, source, tags, status } = req.body || {};
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });

    const existing = await db.prepare(`SELECT id FROM newsletter_subscribers WHERE email = ?`).get([email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already subscribed', id: existing.id });

    const info = await db.prepare(`
      INSERT INTO newsletter_subscribers (email, name, company, title, source, tags, status, unsubscribe_token)
      VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?)
    `).run([
      email.toLowerCase(),
      name || null,
      company || null,
      title || null,
      source || 'manual',
      JSON.stringify(Array.isArray(tags) ? tags : []),
      status || 'active',
      uuid(),
    ]);
    const row = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE id = ?`).get([info.lastInsertRowid]);
    res.status(201).json({ ...row, tags: normalizeArray(row.tags) });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { name, company, title, tags, status, source } = req.body || {};
    const existing = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`
      UPDATE newsletter_subscribers
      SET name = ?, company = ?, title = ?, tags = ?::jsonb, status = ?, source = ?
      WHERE id = ?
    `).run([
      name ?? existing.name,
      company ?? existing.company,
      title ?? existing.title,
      tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : JSON.stringify(normalizeArray(existing.tags)),
      status ?? existing.status,
      source ?? existing.source,
      req.params.id,
    ]);
    const row = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE id = ?`).get([req.params.id]);
    res.json({ ...row, tags: normalizeArray(row.tags) });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const result = await db.prepare(`DELETE FROM newsletter_subscribers WHERE id = ?`).run([req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/import', async (req, res, next) => {
  try {
    const db = openDb();
    const { rows } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] required' });

    const stats = { inserted: 0, skipped_duplicate: 0, invalid: 0 };
    for (const r of rows) {
      const email = (r.email || '').trim().toLowerCase();
      if (!email.includes('@')) { stats.invalid += 1; continue; }
      const exists = await db.prepare(`SELECT 1 AS x FROM newsletter_subscribers WHERE email = ?`).get([email]);
      if (exists) { stats.skipped_duplicate += 1; continue; }
      await db.prepare(`
        INSERT INTO newsletter_subscribers (email, name, company, title, source, tags, status, unsubscribe_token)
        VALUES (?, ?, ?, ?, ?, ?::jsonb, 'active', ?)
      `).run([
        email,
        r.name || null,
        r.company || null,
        r.title || null,
        r.source || 'import',
        JSON.stringify(Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',').map((s) => s.trim()).filter(Boolean) : [])),
        uuid(),
      ]);
      stats.inserted += 1;
    }
    res.json(stats);
  } catch (e) { next(e); }
});

router.get('/unsubscribe/:token', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ?`).get([req.params.token]);
    if (!row) return res.status(404).send('Invalid unsubscribe link.');
    await db.prepare(`UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE id = ?`).run([row.id]);
    res.send(`<html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:0 auto;">
      <h2>Unsubscribed.</h2>
      <p>${row.email} will no longer receive the newsletter.</p>
      <p>If this was a mistake, reply to any previous email and we'll add you back.</p>
    </body></html>`);
  } catch (e) { next(e); }
});

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

module.exports = router;
