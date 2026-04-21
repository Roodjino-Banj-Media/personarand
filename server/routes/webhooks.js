const express = require('express');
const { Webhook } = require('svix');
const { openDb } = require('../db');

const router = express.Router();

// Resend signs outbound webhooks with Svix. Verify every request against the
// shared secret before trusting ANY field in the body — without this, anyone
// on the internet can forge bounce/complaint events and poison subscriber
// status or inflate engagement metrics.
function verifyResendSignature(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail-closed in production so a misconfigured deploy can't silently
    // accept unverified traffic. Dev keeps working without the secret.
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'RESEND_WEBHOOK_SECRET not set' };
    }
    return { ok: true, unverified: true };
  }
  try {
    const wh = new Webhook(secret);
    const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
    const headers = {
      'svix-id': req.header('svix-id') || '',
      'svix-timestamp': req.header('svix-timestamp') || '',
      'svix-signature': req.header('svix-signature') || '',
    };
    wh.verify(payload, headers);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

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

router.post('/resend', async (req, res, next) => {
  try {
    const verification = verifyResendSignature(req);
    if (!verification.ok) {
      console.warn('[webhook:resend] rejected:', verification.reason);
      return res.status(401).json({ error: 'Invalid signature' });
    }
    if (verification.unverified) {
      console.warn('[webhook:resend] accepted UNVERIFIED (dev mode) — set RESEND_WEBHOOK_SECRET in production');
    }

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
