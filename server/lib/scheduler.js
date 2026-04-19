const { openDb } = require('../db');
const { sendBatch, publicBaseUrl, isConfigured } = require('./email');
const { renderNewsletterHtml, renderPlainText } = require('./newsletterHtml');
const { EMAILS: WELCOME_EMAILS, personalize } = require('./welcomeSequence');

async function runDueIssues() {
  const db = openDb();
  const due = await db.prepare(`
    SELECT * FROM newsletter_issues WHERE status = 'scheduled' AND scheduled_send <= NOW()
  `).all();
  if (due.length === 0) return { sent_issues: 0 };

  let sent = 0;
  for (const issue of due) {
    try {
      await sendIssueToAll(issue);
      sent += 1;
    } catch (err) {
      console.error(`[scheduler] failed to send issue ${issue.id}:`, err.message);
    }
  }
  return { sent_issues: sent };
}

async function sendIssueToAll(issue) {
  const db = openDb();
  const subscribers = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE status = 'active'`).all();
  if (subscribers.length === 0) {
    await db.prepare(`UPDATE newsletter_issues SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?`).run([issue.id]);
    return;
  }
  const base = publicBaseUrl();
  const payload = subscribers.map((sub) => ({
    to: sub.email,
    subject: issue.subject_line,
    html: renderNewsletterHtml({
      title: issue.title,
      markdown: issue.content_md,
      subscriberEmail: sub.email,
      unsubscribeUrl: `${base}/api/subscribers/unsubscribe/${sub.unsubscribe_token}`,
      trackingPixelUrl: `${base}/api/webhooks/open/${issue.id}/${sub.id}`,
    }),
    text: renderPlainText({ title: issue.title, markdown: issue.content_md }),
    tags: [{ name: 'newsletter_id', value: String(issue.id) }],
    subscriber_id: sub.id,
  }));
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
    UPDATE newsletter_issues SET status = 'sent', sent_at = CURRENT_TIMESTAMP, total_sent = ? WHERE id = ?
  `).run([subscribers.length, issue.id]);
}

async function runWelcomeSequence() {
  const db = openDb();
  const results = { sent: 0, by_key: {} };
  for (const email of WELCOME_EMAILS) {
    const position = email.key.slice(-1);
    const col = `welcome_email_${position}_sent_at`;
    const rows = await db.prepare(`
      SELECT * FROM newsletter_subscribers
      WHERE status = 'active'
        AND ${col} IS NULL
        AND EXTRACT(EPOCH FROM (NOW() - subscribed_at))/86400 >= ?
      LIMIT 50
    `).all([email.day_offset]);
    if (rows.length === 0) continue;

    const base = publicBaseUrl();
    const payload = rows.map((sub) => {
      const md = personalize(email.markdown_body, sub);
      return {
        to: sub.email,
        subject: email.subject,
        html: renderNewsletterHtml({
          title: email.subject, markdown: md,
          subscriberEmail: sub.email,
          unsubscribeUrl: `${base}/api/subscribers/unsubscribe/${sub.unsubscribe_token}`,
          trackingPixelUrl: null,
        }),
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
      }
    }
    results.by_key[email.key] = rows.length;
  }
  return results;
}

// In-process interval scheduler (local dev only). Production uses GitHub Actions
// cron hitting /api/cron/run-due-jobs every 15 minutes.
let intervalId = null;
function start() {
  if (process.env.NODE_ENV === 'production') return; // serverless — no daemons
  if (intervalId) return;
  intervalId = setInterval(async () => {
    try {
      await runDueIssues();
      await runWelcomeSequence();
    } catch (err) {
      console.error('[scheduler tick]', err.message);
    }
  }, 60_000);
  console.log('[scheduler] started (60s interval, dev mode)');
}

function stop() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

module.exports = { start, stop, runDueIssues, runWelcomeSequence };
