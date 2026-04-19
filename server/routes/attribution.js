const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

router.get('/content-revenue', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT gc.id, gc.title, gc.content_type, gc.platform,
        COUNT(DISTINCT ac.prospect_id) AS prospects_influenced,
        COUNT(DISTINCT ac.meeting_id) AS meetings,
        COALESCE(SUM(ac.deal_value), 0) AS attributed_revenue
      FROM attribution_chain ac
      JOIN generated_content gc ON gc.id = ac.content_id
      WHERE ac.deal_value IS NOT NULL
      GROUP BY gc.id
      ORDER BY attributed_revenue DESC
    `).all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/journey/:prospect_id', async (req, res, next) => {
  try {
    const db = openDb();
    const prospect = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([req.params.prospect_id]);
    if (!prospect) return res.status(404).json({ error: 'Not found' });
    const events = await db.prepare(`SELECT * FROM engagement_events WHERE entity_type = 'prospect' AND entity_id = ? ORDER BY created_at ASC`).all([req.params.prospect_id]);
    const subscriber = await db.prepare(`
      SELECT s.*, psl.linked_at
      FROM prospect_subscriber_link psl
      JOIN newsletter_subscribers s ON s.id = psl.subscriber_id
      WHERE psl.prospect_id = ?
    `).get([req.params.prospect_id]);
    const chain = await db.prepare(`
      SELECT ac.*, gc.title AS content_title, ni.title AS newsletter_title
      FROM attribution_chain ac
      LEFT JOIN generated_content gc ON gc.id = ac.content_id
      LEFT JOIN newsletter_issues ni ON ni.id = ac.newsletter_id
      WHERE ac.prospect_id = ?
    `).all([req.params.prospect_id]);
    res.json({ prospect, events, subscriber, chain });
  } catch (e) { next(e); }
});

router.post('/newsletter-to-prospect', async (req, res, next) => {
  try {
    const db = openDb();
    const { subscriber_id } = req.body || {};
    const sub = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE id = ?`).get([subscriber_id]);
    if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
    if (!sub.email) return res.status(400).json({ error: 'Subscriber has no email' });
    let prospect = await db.prepare(`SELECT * FROM prospects WHERE email = ?`).get([sub.email]);
    if (!prospect) {
      const tagsJson = typeof sub.tags === 'string' ? sub.tags : JSON.stringify(sub.tags || []);
      const info = await db.prepare(`
        INSERT INTO prospects (name, email, source, tags, status, stage)
        VALUES (?, ?, 'newsletter', ?::jsonb, 'cold', 'prospecting')
      `).run([sub.name || sub.email, sub.email, tagsJson]);
      prospect = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([info.lastInsertRowid]);
    }
    await db.prepare(`INSERT INTO prospect_subscriber_link (prospect_id, subscriber_id) VALUES (?, ?) ON CONFLICT DO NOTHING`).run([prospect.id, sub.id]);
    res.json({ prospect_id: prospect.id, subscriber_id: sub.id, linked: true });
  } catch (e) { next(e); }
});

router.post('/prospect-to-newsletter', async (req, res, next) => {
  try {
    const db = openDb();
    const { v4: uuid } = require('uuid');
    const { prospect_id } = req.body || {};
    const p = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([prospect_id]);
    if (!p) return res.status(404).json({ error: 'Prospect not found' });
    if (!p.email) return res.status(400).json({ error: 'Prospect has no email' });
    let sub = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE email = ?`).get([p.email]);
    if (!sub) {
      const info = await db.prepare(`
        INSERT INTO newsletter_subscribers (email, name, company, source, status, unsubscribe_token)
        VALUES (?, ?, ?, 'prospecting', 'active', ?)
      `).run([p.email, p.name, p.company || null, uuid()]);
      sub = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE id = ?`).get([info.lastInsertRowid]);
    }
    await db.prepare(`INSERT INTO prospect_subscriber_link (prospect_id, subscriber_id) VALUES (?, ?) ON CONFLICT DO NOTHING`).run([p.id, sub.id]);
    res.json({ prospect_id: p.id, subscriber_id: sub.id, linked: true });
  } catch (e) { next(e); }
});

router.get('/hot-prospects', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT s.*, p.id AS prospect_id, p.stage, p.company
      FROM newsletter_subscribers s
      LEFT JOIN prospect_subscriber_link psl ON psl.subscriber_id = s.id
      LEFT JOIN prospects p ON p.id = psl.prospect_id
      WHERE s.status = 'active'
        AND (s.total_opens * 10 + s.total_clicks * 5 -
          CASE WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_engagement_at, s.subscribed_at)))/86400 > 30 THEN 5 ELSE 0 END) >= 50
      ORDER BY s.total_opens DESC, s.total_clicks DESC
      LIMIT 20
    `).all();
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
