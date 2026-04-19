const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const status = req.query.status || 'active';
    const rows = await db.prepare(`SELECT * FROM insights WHERE status = ? ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC`).all([status]);
    res.json(rows.map((r) => ({ ...r, data: normalizeObj(r.data) })));
  } catch (e) { next(e); }
});

router.post('/:id/dismiss', async (req, res, next) => {
  try {
    const db = openDb();
    const r = await db.prepare(`UPDATE insights SET status = 'dismissed', dismissed_at = CURRENT_TIMESTAMP WHERE id = ?`).run([req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/generate', async (req, res, next) => {
  try {
    const db = openDb();
    const created = [];

    const hotUnlinkedRows = await db.prepare(`
      SELECT s.*, (s.total_opens * 10 + s.total_clicks * 5) AS score
      FROM newsletter_subscribers s
      LEFT JOIN prospect_subscriber_link psl ON psl.subscriber_id = s.id
      WHERE psl.prospect_id IS NULL AND s.status = 'active'
        AND s.total_opens + s.total_clicks > 0
        AND (s.total_opens * 10 + s.total_clicks * 5) >= 40
      LIMIT 10
    `).all();
    if (hotUnlinkedRows.length > 0) {
      const info = await db.prepare(`
        INSERT INTO insights (insight_type, title, description, data, action_recommended, priority)
        VALUES (?, ?, ?, ?::jsonb, ?, 'high')
      `).run([
        'hot_subscribers',
        `${hotUnlinkedRows.length} hot newsletter subscribers not yet in prospects`,
        "These subscribers have strong engagement but aren't being actively pursued. Promote them to prospects and send a targeted outreach email.",
        JSON.stringify({ subscribers: hotUnlinkedRows.map((r) => ({ id: r.id, email: r.email, score: Number(r.score) })) }),
        'Convert to prospects and send Newsletter Subscriber Follow-Up template',
      ]);
      created.push(info.lastInsertRowid);
    }

    const stuck = await db.prepare(`
      SELECT id, name, company, EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 AS days
      FROM prospects
      WHERE stage = 'contacted' AND EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 > 10
      LIMIT 10
    `).all();
    if (stuck.length > 0) {
      const info = await db.prepare(`
        INSERT INTO insights (insight_type, title, description, data, action_recommended, priority)
        VALUES (?, ?, ?, ?::jsonb, ?, 'medium')
      `).run([
        'stuck_prospects',
        `${stuck.length} prospects stuck in "contacted" > 10 days`,
        'These have been contacted but no response. Either send re-engagement template or archive.',
        JSON.stringify({ prospects: stuck }),
        'Use Re-engagement template or move to dead',
      ]);
      created.push(info.lastInsertRowid);
    }

    const oldProposals = await db.prepare(`
      SELECT id, name, company, deal_value, EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 AS days
      FROM prospects
      WHERE stage = 'proposal' AND EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 > 7
    `).all();
    if (oldProposals.length > 0) {
      const info = await db.prepare(`
        INSERT INTO insights (insight_type, title, description, data, action_recommended, priority)
        VALUES (?, ?, ?, ?::jsonb, ?, 'high')
      `).run([
        'aging_proposals',
        `${oldProposals.length} proposal${oldProposals.length === 1 ? '' : 's'} awaiting response > 7 days`,
        "Silence after proposal usually means you're losing them. One quick check-in email within 24h.",
        JSON.stringify({ prospects: oldProposals }),
        'Send Proposal Follow-Up template',
      ]);
      created.push(info.lastInsertRowid);
    }

    const topContent = await db.prepare(`
      SELECT gc.id, gc.title, gc.content_type, gc.platform
      FROM generated_content gc
      WHERE gc.status = 'posted'
        AND gc.id NOT IN (SELECT DISTINCT content_id FROM attribution_chain WHERE content_id IS NOT NULL)
      ORDER BY gc.updated_at DESC
      LIMIT 5
    `).all();
    if (topContent.length > 0) {
      const info = await db.prepare(`
        INSERT INTO insights (insight_type, title, description, data, action_recommended, priority)
        VALUES (?, ?, ?, ?::jsonb, ?, 'low')
      `).run([
        'unattributed_content',
        `${topContent.length} posted pieces with no attributed outcome`,
        "Either no results yet, or you're not tagging outcomes back to content. Worth a look.",
        JSON.stringify({ content: topContent }),
        'Link closed deals to the content that originated them',
      ]);
      created.push(info.lastInsertRowid);
    }

    res.json({ created_count: created.length, created_ids: created });
  } catch (err) { next(err); }
});

function normalizeObj(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } }
  return {};
}

module.exports = router;
