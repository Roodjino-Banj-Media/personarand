const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const OUTCOMES = ['qualified', 'needs_nurturing', 'not_fit', 'follow_up', 'proposal_sent', 'closed_won'];
const STAGE_BY_OUTCOME = {
  qualified: 'proposal',
  proposal_sent: 'proposal',
  needs_nurturing: 'meeting_done',
  follow_up: 'meeting_done',
  not_fit: 'dead',
  closed_won: 'client',
};

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { status, upcoming } = req.query;
    const clauses = [];
    const params = {};
    if (status) { clauses.push('m.status = @status'); params.status = status; }
    if (upcoming) { clauses.push("m.scheduled_date >= NOW()"); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.prepare(`
      SELECT m.*, p.name AS prospect_name, p.company AS prospect_company, p.email AS prospect_email
      FROM meetings m JOIN prospects p ON p.id = m.prospect_id
      ${where}
      ORDER BY m.scheduled_date DESC
    `).all(params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const m = await db.prepare(`
      SELECT m.*, p.name AS prospect_name, p.company AS prospect_company, p.email AS prospect_email,
             p.pain_points AS prospect_pain_points, p.linkedin_context AS prospect_context
      FROM meetings m JOIN prospects p ON p.id = m.prospect_id
      WHERE m.id = ?
    `).get([req.params.id]);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const priorEmails = await db.prepare(`SELECT id, subject, sent_at, replied_at FROM email_outreach WHERE prospect_id = ? ORDER BY sent_at DESC LIMIT 10`).all([m.prospect_id]);
    res.json({ ...m, prior_emails: priorEmails });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    if (!b.prospect_id || !b.scheduled_date) return res.status(400).json({ error: 'prospect_id + scheduled_date required' });
    const info = await db.prepare(`
      INSERT INTO meetings (prospect_id, scheduled_date, duration, meeting_type, location, prep_notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
    `).run([b.prospect_id, b.scheduled_date, b.duration || 30, b.meeting_type || 'discovery', b.location || null, b.prep_notes || null]);

    await db.prepare(`UPDATE prospects SET stage = 'meeting_booked', status = 'meeting_booked', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run([b.prospect_id]);
    await db.prepare(`INSERT INTO engagement_events (entity_type, entity_id, event_type, event_data) VALUES (?, ?, ?, ?::jsonb)`)
      .run(['prospect', b.prospect_id, 'meeting_booked', JSON.stringify({ scheduled_date: b.scheduled_date })]);

    const row = await db.prepare(`SELECT * FROM meetings WHERE id = ?`).get([info.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    const existing = await db.prepare(`SELECT * FROM meetings WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = { ...existing, ...b };
    await db.prepare(`
      UPDATE meetings SET scheduled_date = ?, duration = ?, meeting_type = ?, location = ?, status = ?, prep_notes = ?
      WHERE id = ?
    `).run([merged.scheduled_date, merged.duration, merged.meeting_type, merged.location, merged.status, merged.prep_notes, req.params.id]);
    const row = await db.prepare(`SELECT * FROM meetings WHERE id = ?`).get([req.params.id]);
    res.json(row);
  } catch (e) { next(e); }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    if (!OUTCOMES.includes(b.outcome)) return res.status(400).json({ error: `outcome must be one of ${OUTCOMES.join(', ')}` });
    const meeting = await db.prepare(`SELECT * FROM meetings WHERE id = ?`).get([req.params.id]);
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`
      UPDATE meetings SET
        status = 'completed', outcome = ?, meeting_notes = ?, key_takeaways = ?,
        pain_points_identified = ?, budget_signals = ?, decision_makers = ?, timeline = ?, next_steps = ?,
        completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      b.outcome, b.meeting_notes || null, b.key_takeaways || null,
      b.pain_points_identified || null, b.budget_signals || null, b.decision_makers || null,
      b.timeline || null, b.next_steps || null, req.params.id,
    ]);

    const newStage = STAGE_BY_OUTCOME[b.outcome];
    if (newStage) {
      if (b.outcome === 'closed_won') {
        await db.prepare(`UPDATE prospects SET status = 'client', stage = 'client', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run([meeting.prospect_id]);
      } else {
        await db.prepare(`UPDATE prospects SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run([newStage, meeting.prospect_id]);
      }
    }
    if (b.outcome === 'closed_won' && b.deal_value) {
      await db.prepare(`UPDATE prospects SET deal_value = ? WHERE id = ?`).run([Number(b.deal_value), meeting.prospect_id]);
      await db.prepare(`INSERT INTO attribution_chain (prospect_id, meeting_id, deal_value, conversion_date) VALUES (?, ?, ?, CURRENT_DATE)`)
        .run([meeting.prospect_id, meeting.id, Number(b.deal_value)]);
    }
    await db.prepare(`INSERT INTO engagement_events (entity_type, entity_id, event_type, event_data) VALUES (?, ?, ?, ?::jsonb)`)
      .run(['prospect', meeting.prospect_id, 'meeting_completed', JSON.stringify({ outcome: b.outcome })]);

    const row = await db.prepare(`SELECT * FROM meetings WHERE id = ?`).get([req.params.id]);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const r = await db.prepare(`DELETE FROM meetings WHERE id = ?`).run([req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/outcomes/list', (req, res) => res.json(OUTCOMES));

module.exports = router;
