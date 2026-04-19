const express = require('express');
const { openDb } = require('../db');
const { sendBatch, publicBaseUrl, isConfigured } = require('../lib/email');
const { renderNewsletterHtml, renderPlainText } = require('../lib/newsletterHtml');
const { EMAILS, personalize } = require('../lib/welcomeSequence');

const router = express.Router();

router.get('/due', async (req, res, next) => {
  try {
    const db = openDb();
    const due = [];
    for (const email of EMAILS) {
      const position = email.key.slice(-1);
      const col = `welcome_email_${position}_sent_at`;
      const rows = await db.prepare(`
        SELECT id, email, name, subscribed_at, ${col} AS sent_at, unsubscribe_token
        FROM newsletter_subscribers
        WHERE status = 'active'
          AND ${col} IS NULL
          AND EXTRACT(EPOCH FROM (NOW() - subscribed_at))/86400 >= ?
        ORDER BY subscribed_at ASC
        LIMIT 200
      `).all([email.day_offset]);
      for (const r of rows) due.push({ ...r, sequence_key: email.key, subject: email.subject });
    }
    res.json({ due, configured: isConfigured() });
  } catch (e) { next(e); }
});

router.get('/preview/:key', (req, res) => {
  const email = EMAILS.find((e) => e.key === req.params.key);
  if (!email) return res.status(404).json({ error: 'unknown key' });
  const sampleSub = { name: 'Sample', email: 'sample@example.com' };
  const markdown = personalize(email.markdown_body, sampleSub);
  const html = renderNewsletterHtml({
    title: email.subject,
    markdown,
    subscriberEmail: sampleSub.email,
    unsubscribeUrl: '#',
    trackingPixelUrl: null,
  });
  res.json({ ...email, markdown_preview: markdown, html_preview: html });
});

router.post('/run', async (req, res, next) => {
  try {
    const db = openDb();
    const results = { sent: 0, failed: 0, by_key: {} };
    const base = publicBaseUrl();

    for (const email of EMAILS) {
      const position = email.key.slice(-1);
      const col = `welcome_email_${position}_sent_at`;
      const rows = await db.prepare(`
        SELECT * FROM newsletter_subscribers
        WHERE status = 'active'
          AND ${col} IS NULL
          AND EXTRACT(EPOCH FROM (NOW() - subscribed_at))/86400 >= ?
        LIMIT 100
      `).all([email.day_offset]);
      if (rows.length === 0) continue;

      const payload = rows.map((sub) => {
        const md = personalize(email.markdown_body, sub);
        const unsubscribeUrl = `${base}/api/subscribers/unsubscribe/${sub.unsubscribe_token}`;
        return {
          to: sub.email,
          subject: email.subject,
          html: renderNewsletterHtml({ title: email.subject, markdown: md, subscriberEmail: sub.email, unsubscribeUrl, trackingPixelUrl: null }),
          text: renderPlainText({ title: email.subject, markdown: md }),
          tags: [{ name: 'welcome_sequence', value: email.key }],
          subscriber_id: sub.id,
        };
      });

      const sendResults = await sendBatch(payload.map(({ subscriber_id, ...p }) => p));
      for (let i = 0; i < payload.length; i++) {
        const p = payload[i];
        if (sendResults[i]?.delivered || sendResults[i]?.id?.startsWith?.('stub-')) {
          await db.prepare(`UPDATE newsletter_subscribers SET ${col} = CURRENT_TIMESTAMP WHERE id = ?`).run([p.subscriber_id]);
          results.sent += 1;
        } else {
          results.failed += 1;
        }
      }
      results.by_key[email.key] = rows.length;
    }

    res.json({ ...results, configured: isConfigured() });
  } catch (err) { console.error('[welcome:run]', err); next(err); }
});

module.exports = router;
