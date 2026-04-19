const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { category, best_for } = req.query;
    const clauses = [];
    const params = {};
    if (category) { clauses.push('category = @category'); params.category = category; }
    if (best_for) { clauses.push('best_for = @best_for'); params.best_for = best_for; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.prepare(`SELECT * FROM email_templates ${where} ORDER BY times_used DESC, name`).all(params);
    res.json(rows.map((r) => ({
      ...r,
      variables: normalizeArray(r.variables),
      response_rate: r.times_used > 0 ? +(r.times_replied / r.times_used * 100).toFixed(1) : null,
    })));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get([req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, variables: normalizeArray(row.variables) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    if (!b.name || !b.subject_line || !b.body) return res.status(400).json({ error: 'name, subject_line, body required' });
    const info = await db.prepare(`
      INSERT INTO email_templates (name, category, subject_line, body, variables, best_for)
      VALUES (?, ?, ?, ?, ?::jsonb, ?)
    `).run([
      b.name, b.category || 'custom', b.subject_line, b.body,
      JSON.stringify(extractVariables(b.subject_line + ' ' + b.body)),
      b.best_for || 'cold',
    ]);
    const row = await db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get([info.lastInsertRowid]);
    res.status(201).json({ ...row, variables: normalizeArray(row.variables) });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    const existing = await db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const subject = b.subject_line ?? existing.subject_line;
    const body = b.body ?? existing.body;
    const variables = JSON.stringify(extractVariables(subject + ' ' + body));
    await db.prepare(`
      UPDATE email_templates SET name = ?, category = ?, subject_line = ?, body = ?, variables = ?::jsonb, best_for = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      b.name ?? existing.name, b.category ?? existing.category, subject, body, variables,
      b.best_for ?? existing.best_for, req.params.id,
    ]);
    const row = await db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get([req.params.id]);
    res.json({ ...row, variables: normalizeArray(row.variables) });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const r = await db.prepare(`DELETE FROM email_templates WHERE id = ?`).run([req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function extractVariables(text) {
  const seen = new Set();
  const re = /\{([a-z_0-9]+)\}/gi;
  let m;
  while ((m = re.exec(text)) !== null) seen.add(m[1]);
  return [...seen];
}

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

module.exports = router;
