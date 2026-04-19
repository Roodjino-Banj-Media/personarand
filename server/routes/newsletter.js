const express = require('express');
const { openDb } = require('../db');
const { sendBatch, publicBaseUrl, isConfigured } = require('../lib/email');
const { renderNewsletterHtml, renderPlainText } = require('../lib/newsletterHtml');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT i.*,
        CASE WHEN i.total_sent > 0 THEN ROUND(CAST(i.total_opens AS NUMERIC) / i.total_sent * 100, 1) ELSE NULL END AS open_rate,
        CASE WHEN i.total_opens > 0 THEN ROUND(CAST(i.total_clicks AS NUMERIC) / i.total_opens * 100, 1) ELSE NULL END AS click_rate
      FROM newsletter_issues i
      ORDER BY COALESCE(i.sent_at, i.scheduled_send, i.updated_at) DESC
    `).all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const links = await db.prepare(`
      SELECT gc.*
      FROM newsletter_content_links ncl
      JOIN generated_content gc ON gc.id = ncl.content_id
      WHERE ncl.newsletter_id = ?
    `).all([req.params.id]);
    res.json({ ...row, content_links: links });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { title, subject_line, content_md, template_type, content_ids } = req.body || {};
    const info = await db.prepare(`
      INSERT INTO newsletter_issues (title, subject_line, content_md, template_type, status)
      VALUES (?, ?, ?, ?, 'draft')
    `).run([
      title || 'Untitled issue',
      subject_line || '',
      content_md || '',
      template_type || 'deep_dive',
    ]);
    if (Array.isArray(content_ids) && content_ids.length) {
      for (const cid of content_ids) {
        await db.prepare(`INSERT INTO newsletter_content_links (newsletter_id, content_id) VALUES (?, ?) ON CONFLICT DO NOTHING`).run([info.lastInsertRowid, cid]);
      }
    }
    const row = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([info.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { title, subject_line, content_md, template_type, status, scheduled_send } = req.body || {};
    const existing = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`
      UPDATE newsletter_issues
      SET title = ?, subject_line = ?, content_md = ?, template_type = ?, status = ?, scheduled_send = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([
      title ?? existing.title,
      subject_line ?? existing.subject_line,
      content_md ?? existing.content_md,
      template_type ?? existing.template_type,
      status ?? existing.status,
      scheduled_send !== undefined ? scheduled_send : existing.scheduled_send,
      req.params.id,
    ]);
    const row = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([req.params.id]);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const result = await db.prepare(`DELETE FROM newsletter_issues WHERE id = ?`).run([req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/send-test', async (req, res, next) => {
  try {
    const db = openDb();
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ error: 'to address required' });

    const issue = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Not found' });

    const html = renderNewsletterHtml({
      title: issue.title,
      markdown: issue.content_md,
      subscriberEmail: to,
      unsubscribeUrl: `${publicBaseUrl()}/api/subscribers/unsubscribe/test`,
      trackingPixelUrl: null,
    });
    const results = await sendBatch([{
      to, subject: `[TEST] ${issue.subject_line}`,
      html,
      text: renderPlainText({ title: issue.title, markdown: issue.content_md }),
    }]);
    res.json({ configured: isConfigured(), results });
  } catch (e) { next(e); }
});

router.post('/:id/send', async (req, res, next) => {
  try {
    const db = openDb();
    const { audience = 'all' } = req.body || {};

    const issue = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Not found' });
    if (issue.status === 'sent') return res.status(400).json({ error: 'Already sent. Clone to resend.' });

    let subscribers;
    if (audience === 'all') {
      subscribers = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE status = 'active'`).all();
    } else if (audience === 'engaged') {
      subscribers = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE status = 'active' AND (total_opens > 0 OR total_clicks > 0)`).all();
    } else {
      return res.status(400).json({ error: `audience must be "all" or "engaged"` });
    }

    if (subscribers.length === 0) return res.status(400).json({ error: 'No active subscribers.' });

    const base = publicBaseUrl();
    const payload = subscribers.map((sub) => {
      const unsubscribeUrl = `${base}/api/subscribers/unsubscribe/${sub.unsubscribe_token}`;
      const trackingPixelUrl = `${base}/api/webhooks/open/${issue.id}/${sub.id}`;
      return {
        to: sub.email,
        subject: issue.subject_line,
        html: renderNewsletterHtml({
          title: issue.title,
          markdown: issue.content_md,
          subscriberEmail: sub.email,
          unsubscribeUrl,
          trackingPixelUrl,
        }),
        text: renderPlainText({ title: issue.title, markdown: issue.content_md }),
        tags: [{ name: 'newsletter_id', value: String(issue.id) }],
        subscriber_id: sub.id,
      };
    });

    const results = await sendBatch(payload.map(({ subscriber_id, ...p }) => p));

    for (let i = 0; i < payload.length; i++) {
      const p = payload[i];
      await db.prepare(`
        INSERT INTO newsletter_engagement (subscriber_id, issue_id, resend_message_id)
        VALUES (?, ?, ?)
        ON CONFLICT (subscriber_id, issue_id) DO UPDATE SET resend_message_id = EXCLUDED.resend_message_id
      `).run([p.subscriber_id, issue.id, results[i]?.id || null]);
    }
    await db.prepare(`
      UPDATE newsletter_issues
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, total_sent = ?
      WHERE id = ?
    `).run([subscribers.length, issue.id]);

    const delivered = results.filter((r) => r.delivered).length;
    res.json({ configured: isConfigured(), total_sent: subscribers.length, delivered, stub: !isConfigured() });
  } catch (err) { console.error('[newsletter:send]', err); next(err); }
});

router.get('/analytics/overview', async (req, res, next) => {
  try {
    const db = openDb();
    const totalSubs = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE status = 'active'`).get()).n);
    const sentCount = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_issues WHERE status = 'sent'`).get()).n);
    const rateAvg = await db.prepare(`
      SELECT
        AVG(CASE WHEN total_sent > 0 THEN CAST(total_opens AS NUMERIC) / total_sent ELSE 0 END) AS avg_open_rate,
        AVG(CASE WHEN total_opens > 0 THEN CAST(total_clicks AS NUMERIC) / total_opens ELSE 0 END) AS avg_click_rate
      FROM newsletter_issues WHERE status = 'sent'
    `).get();
    const latest = await db.prepare(`SELECT * FROM newsletter_issues WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1`).get();
    res.json({
      total_subscribers: totalSubs,
      issues_sent: sentCount,
      avg_open_rate: rateAvg?.avg_open_rate ? +(Number(rateAvg.avg_open_rate) * 100).toFixed(1) : null,
      avg_click_rate: rateAvg?.avg_click_rate ? +(Number(rateAvg.avg_click_rate) * 100).toFixed(1) : null,
      latest,
      esp_configured: isConfigured(),
    });
  } catch (e) { next(e); }
});

router.get('/:id/analytics', async (req, res, next) => {
  try {
    const db = openDb();
    const issue = await db.prepare(`SELECT * FROM newsletter_issues WHERE id = ?`).get([req.params.id]);
    if (!issue) return res.status(404).json({ error: 'Not found' });
    const opens = await db.prepare(`
      SELECT s.email, s.name, e.opened_at, e.clicked_at
      FROM newsletter_engagement e
      JOIN newsletter_subscribers s ON s.id = e.subscriber_id
      WHERE e.issue_id = ? AND e.opened_at IS NOT NULL
      ORDER BY e.opened_at DESC
    `).all([req.params.id]);
    res.json({
      issue,
      opens,
      open_rate: issue.total_sent > 0 ? +(issue.total_opens / issue.total_sent * 100).toFixed(1) : null,
      click_rate: issue.total_opens > 0 ? +(issue.total_clicks / issue.total_opens * 100).toFixed(1) : null,
    });
  } catch (e) { next(e); }
});

module.exports = router;
