const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { platform, content_type, funnel_layer, status, q, sort } = req.query;
    const clauses = [];
    const params = {};
    if (platform) { clauses.push('gc.platform = @platform'); params.platform = platform; }
    if (content_type) { clauses.push('gc.content_type = @content_type'); params.content_type = content_type; }
    if (status) { clauses.push('gc.status = @status'); params.status = status; }
    if (funnel_layer) { clauses.push('cc.funnel_layer ILIKE @funnel_layer'); params.funnel_layer = `%${funnel_layer}%`; }
    if (q) { clauses.push('(gc.title ILIKE @q OR gc.body ILIKE @q)'); params.q = `%${q}%`; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const orderBy = {
      newest: 'gc.created_at DESC',
      oldest: 'gc.created_at ASC',
      updated: 'gc.updated_at DESC',
      unposted: `CASE WHEN gc.status = 'draft' THEN 0 ELSE 1 END, gc.created_at DESC`,
    }[sort] || 'gc.created_at DESC';

    const rows = await db.prepare(`
      SELECT gc.*, cc.funnel_layer AS calendar_funnel_layer, cc.title AS calendar_title, cc.week AS calendar_week,
        (SELECT string_agg(ni.title, ' | ')
          FROM newsletter_content_links ncl
          JOIN newsletter_issues ni ON ni.id = ncl.newsletter_id
          WHERE ncl.content_id = gc.id) AS featured_in_newsletters
      FROM generated_content gc
      LEFT JOIN content_calendar cc ON cc.id = gc.calendar_id
      ${where}
      ORDER BY ${orderBy}
    `).all(params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/facets', async (req, res, next) => {
  try {
    const db = openDb();
    const platforms = (await db.prepare(`SELECT DISTINCT platform FROM generated_content WHERE platform IS NOT NULL ORDER BY platform`).all()).map((r) => r.platform);
    const content_types = (await db.prepare(`SELECT DISTINCT content_type FROM generated_content WHERE content_type IS NOT NULL ORDER BY content_type`).all()).map((r) => r.content_type);
    const funnel_layers = (await db.prepare(`
      SELECT DISTINCT cc.funnel_layer
      FROM generated_content gc
      LEFT JOIN content_calendar cc ON cc.id = gc.calendar_id
      WHERE cc.funnel_layer IS NOT NULL
      ORDER BY cc.funnel_layer
    `).all()).map((r) => r.funnel_layer);
    res.json({ platforms, content_types, funnel_layers });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare('SELECT * FROM generated_content WHERE id = ?').get([req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { next(e); }
});

router.post('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { body, title, status, performance_notes } = req.body || {};
    const existing = await db.prepare('SELECT * FROM generated_content WHERE id = ?').get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await db.prepare(`
      UPDATE generated_content
      SET body = ?, title = ?, status = ?, performance_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      body ?? existing.body,
      title ?? existing.title,
      status ?? existing.status,
      performance_notes ?? existing.performance_notes,
      req.params.id,
    ]);

    const row = await db.prepare('SELECT * FROM generated_content WHERE id = ?').get([req.params.id]);
    res.json(row);
  } catch (e) { next(e); }
});

module.exports = router;
