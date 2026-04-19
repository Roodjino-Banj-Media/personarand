const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const OUTCOME_TYPES = ['inquiry', 'speaking', 'intro', 'revenue'];

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { type, since } = req.query;
    const clauses = [];
    const params = {};
    if (type) { clauses.push('outcome_type = @type'); params.type = type; }
    if (since) { clauses.push('date >= @since'); params.since = since; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.prepare(`SELECT * FROM commercial_outcomes ${where} ORDER BY date DESC, id DESC`).all(params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/summary', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT outcome_type, COUNT(*) AS count, COALESCE(SUM(value), 0) AS total_value
      FROM commercial_outcomes
      GROUP BY outcome_type
    `).all();
    const byType = Object.fromEntries(OUTCOME_TYPES.map((t) => [t, { count: 0, total_value: 0 }]));
    for (const r of rows) {
      if (byType[r.outcome_type]) byType[r.outcome_type] = { count: Number(r.count), total_value: Number(r.total_value) };
    }
    res.json(byType);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { outcome_type, description, value, source, date } = req.body || {};
    if (!OUTCOME_TYPES.includes(outcome_type)) {
      return res.status(400).json({ error: `outcome_type must be one of ${OUTCOME_TYPES.join(', ')}` });
    }
    const info = await db.prepare(`
      INSERT INTO commercial_outcomes (outcome_type, description, value, source, date)
      VALUES (?, ?, ?, ?, ?)
    `).run([
      outcome_type,
      description || null,
      value != null && value !== '' ? Number(value) : null,
      source || null,
      date || new Date().toISOString().slice(0, 10),
    ]);
    const row = await db.prepare('SELECT * FROM commercial_outcomes WHERE id = ?').get([info.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const result = await db.prepare('DELETE FROM commercial_outcomes WHERE id = ?').run([req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/types', (req, res) => res.json(OUTCOME_TYPES));

module.exports = router;
