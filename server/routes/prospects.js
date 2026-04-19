const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const STAGES = ['prospecting', 'contacted', 'responded', 'meeting_booked', 'meeting_done', 'proposal', 'negotiation', 'client', 'dead'];

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { status, stage, industry, source, q } = req.query;
    const clauses = [];
    const params = {};
    if (status) { clauses.push('p.status = @status'); params.status = status; }
    if (stage) { clauses.push('p.stage = @stage'); params.stage = stage; }
    if (industry) { clauses.push('p.industry = @industry'); params.industry = industry; }
    if (source) { clauses.push('p.source = @source'); params.source = source; }
    if (q) { clauses.push('(p.name ILIKE @q OR p.company ILIKE @q OR p.email ILIKE @q)'); params.q = `%${q}%`; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM email_outreach WHERE prospect_id = p.id) AS total_emails,
        (SELECT COUNT(*) FROM email_outreach WHERE prospect_id = p.id AND replied_at IS NOT NULL) AS total_replies,
        (SELECT MAX(sent_at) FROM email_outreach WHERE prospect_id = p.id) AS last_email_at,
        (SELECT COUNT(*) FROM meetings WHERE prospect_id = p.id) AS total_meetings
      FROM prospects p ${where}
      ORDER BY p.created_at DESC
    `).all(params);
    res.json(rows.map((r) => ({ ...r, tags: normalizeArray(r.tags) })));
  } catch (e) { next(e); }
});

router.get('/facets', async (req, res, next) => {
  try {
    const db = openDb();
    const industries = (await db.prepare(`SELECT DISTINCT industry FROM prospects WHERE industry IS NOT NULL ORDER BY industry`).all()).map((r) => r.industry);
    const sources = (await db.prepare(`SELECT DISTINCT source FROM prospects WHERE source IS NOT NULL ORDER BY source`).all()).map((r) => r.source);
    const stageCounts = await db.prepare(`SELECT stage, COUNT(*) AS n FROM prospects GROUP BY stage`).all();
    const stageMap = Object.fromEntries(STAGES.map((s) => [s, 0]));
    for (const r of stageCounts) stageMap[r.stage] = Number(r.n);
    res.json({ industries, sources, stages: stageMap });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const p = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const emails = await db.prepare(`SELECT * FROM email_outreach WHERE prospect_id = ? ORDER BY sent_at DESC`).all([req.params.id]);
    const meetings = await db.prepare(`SELECT * FROM meetings WHERE prospect_id = ? ORDER BY scheduled_date DESC`).all([req.params.id]);
    const subscriberLink = await db.prepare(`
      SELECT s.* FROM prospect_subscriber_link psl
      JOIN newsletter_subscribers s ON s.id = psl.subscriber_id
      WHERE psl.prospect_id = ?
    `).get([req.params.id]);
    res.json({ ...p, tags: normalizeArray(p.tags), emails, meetings, subscriber: subscriberLink || null });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const info = await db.prepare(`
      INSERT INTO prospects (name, company, title, email, phone, linkedin_url, linkedin_context, website, industry, pain_points, status, stage, source, deal_value, notes, tags, next_action, next_action_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
    `).run([
      b.name, b.company || null, b.title || null, b.email ? b.email.toLowerCase() : null,
      b.phone || null, b.linkedin_url || null, b.linkedin_context || null, b.website || null,
      b.industry || null, b.pain_points || null,
      b.status || 'cold', b.stage || 'prospecting', b.source || 'manual',
      b.deal_value || null, b.notes || null,
      JSON.stringify(Array.isArray(b.tags) ? b.tags : []),
      b.next_action || null, b.next_action_date || null,
    ]);
    const row = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([info.lastInsertRowid]);
    res.status(201).json({ ...row, tags: normalizeArray(row.tags) });
  } catch (err) {
    if (err.message?.includes('unique')) return res.status(409).json({ error: 'Prospect with that email already exists' });
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    const existing = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = {
      ...existing, ...b,
      tags: b.tags !== undefined ? JSON.stringify(Array.isArray(b.tags) ? b.tags : []) : JSON.stringify(normalizeArray(existing.tags)),
    };
    await db.prepare(`
      UPDATE prospects SET
        name = ?, company = ?, title = ?, email = ?, phone = ?, linkedin_url = ?, linkedin_context = ?,
        website = ?, industry = ?, pain_points = ?, status = ?, stage = ?, source = ?, deal_value = ?,
        notes = ?, tags = ?::jsonb, next_action = ?, next_action_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      merged.name, merged.company, merged.title, merged.email,
      merged.phone, merged.linkedin_url, merged.linkedin_context, merged.website,
      merged.industry, merged.pain_points, merged.status, merged.stage, merged.source,
      merged.deal_value, merged.notes, merged.tags, merged.next_action, merged.next_action_date,
      req.params.id,
    ]);
    const row = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([req.params.id]);
    res.json({ ...row, tags: normalizeArray(row.tags) });
  } catch (e) { next(e); }
});

router.post('/:id/move', async (req, res, next) => {
  try {
    const db = openDb();
    const { stage } = req.body || {};
    if (!STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of ${STAGES.join(', ')}` });
    const result = await db.prepare(`UPDATE prospects SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run([stage, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`INSERT INTO engagement_events (entity_type, entity_id, event_type, event_data) VALUES (?, ?, ?, ?::jsonb)`)
      .run(['prospect', req.params.id, 'stage_change', JSON.stringify({ to: stage })]);
    const row = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([req.params.id]);
    res.json({ ...row, tags: normalizeArray(row.tags) });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const result = await db.prepare(`DELETE FROM prospects WHERE id = ?`).run([req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/import', async (req, res, next) => {
  try {
    const db = openDb();
    const { rows } = req.body || {};
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows[] required' });
    const stats = { inserted: 0, skipped: 0, invalid: 0 };
    for (const r of rows) {
      if (!r.name || !r.name.trim()) { stats.invalid += 1; continue; }
      try {
        await db.prepare(`
          INSERT INTO prospects (name, company, title, email, phone, linkedin_url, industry, source, tags, status, stage)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'cold', 'prospecting')
          ON CONFLICT (email) DO NOTHING
        `).run([
          r.name.trim(), r.company || null, r.title || null,
          r.email ? r.email.toLowerCase() : null,
          r.phone || null, r.linkedin_url || null, r.industry || null, r.source || 'import',
          JSON.stringify(Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',').map((s) => s.trim()).filter(Boolean) : [])),
        ]);
        stats.inserted += 1;
      } catch { stats.skipped += 1; }
    }
    res.json(stats);
  } catch (e) { next(e); }
});

router.get('/stages/list', (req, res) => res.json(STAGES));

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

module.exports = router;
