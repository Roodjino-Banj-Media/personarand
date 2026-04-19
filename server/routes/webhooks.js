const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/open/:issue_id/:subscriber_id', async (req, res) => {
  const { issue_id, subscriber_id } = req.params;
  try {
    await recordOpen(Number(subscriber_id), Number(issue_id));
  } catch (err) {
    console.error('[webhook:open]', err.message);
  }
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Content-Length': PIXEL.length,
  });
  res.status(200).end(PIXEL);
});

router.get('/click/:issue_id/:subscriber_id', async (req, res) => {
  const { issue_id, subscriber_id } = req.params;
  const url = req.query.url;
  if (!url) return res.status(400).send('url required');
  try {
    await recordClick(Number(subscriber_id), Number(issue_id), url);
  } catch (err) { console.error('[webhook:click]', err.message); }
  res.redirect(302, url);
});

router.post('/resend', express.json(), async (req, res, next) => {
  try {
    const db = openDb();
    const event = req.body || {};
    const type = event.type;
    const data = event.data || {};
    const messageId = data.email_id || data.id;

    if (!type || !messageId) return res.json({ ok: true, ignored: true });

    const row = await db.prepare(`
      SELECT e.*, s.id AS subscriber_id, i.id AS issue_id
      FROM newsletter_engagement e
      JOIN newsletter_subscribers s ON s.id = e.subscriber_id
      JOIN newsletter_issues i ON i.id = e.issue_id
      WHERE e.resend_message_id = ?
    `).get([messageId]);

    if (!row) return res.json({ ok: true, ignored: true, reason: 'unknown message id' });

    switch (type) {
      case 'email.opened':
        await recordOpen(row.subscriber_id, row.issue_id);
        break;
      case 'email.clicked':
        await recordClick(row.subscriber_id, row.issue_id, data.click?.link || '');
        break;
      case 'email.bounced':
        await db.prepare(`UPDATE newsletter_engagement SET bounced_at = CURRENT_TIMESTAMP WHERE id = ?`).run([row.id]);
        await db.prepare(`UPDATE newsletter_subscribers SET status = 'bounced' WHERE id = ?`).run([row.subscriber_id]);
        break;
      case 'email.complained':
        await db.prepare(`UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE id = ?`).run([row.subscriber_id]);
        await db.prepare(`UPDATE newsletter_issues SET total_unsubscribes = total_unsubscribes + 1 WHERE id = ?`).run([row.issue_id]);
        break;
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

async function recordOpen(subscriber_id, issue_id) {
  const db = openDb();
  const existing = await db.prepare(`SELECT opened_at FROM newsletter_engagement WHERE subscriber_id = ? AND issue_id = ?`).get([subscriber_id, issue_id]);
  if (!existing) {
    await db.prepare(`INSERT INTO newsletter_engagement (subscriber_id, issue_id, opened_at) VALUES (?, ?, CURRENT_TIMESTAMP)`).run([subscriber_id, issue_id]);
  } else if (!existing.opened_at) {
    await db.prepare(`UPDATE newsletter_engagement SET opened_at = CURRENT_TIMESTAMP WHERE subscriber_id = ? AND issue_id = ?`).run([subscriber_id, issue_id]);
  } else {
    return;
  }
  await db.prepare(`UPDATE newsletter_subscribers SET total_opens = total_opens + 1, last_engagement_at = CURRENT_TIMESTAMP WHERE id = ?`).run([subscriber_id]);
  await db.prepare(`UPDATE newsletter_issues SET total_opens = total_opens + 1 WHERE id = ?`).run([issue_id]);
}

async function recordClick(subscriber_id, issue_id, url) {
  const db = openDb();
  const existing = await db.prepare(`SELECT * FROM newsletter_engagement WHERE subscriber_id = ? AND issue_id = ?`).get([subscriber_id, issue_id]);
  const links = existing?.links_clicked ? normalizeArray(existing.links_clicked) : [];
  if (url) links.push({ url, at: new Date().toISOString() });

  if (!existing) {
    await db.prepare(`INSERT INTO newsletter_engagement (subscriber_id, issue_id, clicked_at, links_clicked) VALUES (?, ?, CURRENT_TIMESTAMP, ?::jsonb)`).run([subscriber_id, issue_id, JSON.stringify(links)]);
  } else {
    await db.prepare(`UPDATE newsletter_engagement SET clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP), links_clicked = ?::jsonb WHERE subscriber_id = ? AND issue_id = ?`).run([JSON.stringify(links), subscriber_id, issue_id]);
  }
  await db.prepare(`UPDATE newsletter_subscribers SET total_clicks = total_clicks + 1, last_engagement_at = CURRENT_TIMESTAMP WHERE id = ?`).run([subscriber_id]);
  await db.prepare(`UPDATE newsletter_issues SET total_clicks = total_clicks + 1 WHERE id = ?`).run([issue_id]);
}

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

module.exports = router;
