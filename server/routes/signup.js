const express = require('express');
const { v4: uuid } = require('uuid');
const { openDb } = require('../db');
const { sendEmail, publicBaseUrl } = require('../lib/email');
const { renderNewsletterHtml, renderPlainText } = require('../lib/newsletterHtml');
const { EMAILS: WELCOME_EMAILS, personalize } = require('../lib/welcomeSequence');

const router = express.Router();

router.get('/forms', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`SELECT * FROM signup_forms ORDER BY created_at DESC`).all();
    res.json(rows.map((r) => ({ ...r, default_tags: normalizeArray(r.default_tags) })));
  } catch (e) { next(e); }
});

router.get('/forms/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare(`SELECT * FROM signup_forms WHERE id = ?`).get([req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, default_tags: normalizeArray(row.default_tags) });
  } catch (e) { next(e); }
});

router.post('/forms', async (req, res, next) => {
  try {
    const db = openDb();
    const { name, headline, subheadline, cta, placeholder, success_message, default_tags, style } = req.body || {};
    const id = uuid().slice(0, 8);
    await db.prepare(`
      INSERT INTO signup_forms (id, name, headline, subheadline, cta, placeholder, success_message, default_tags, style)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
    `).run([
      id,
      name || 'Untitled form',
      headline || 'Get weekly frameworks on media strategy and AI',
      subheadline || null,
      cta || 'Subscribe',
      placeholder || 'you@work.com',
      success_message || 'Welcome. Check your inbox for email #1.',
      JSON.stringify(Array.isArray(default_tags) ? default_tags : []),
      style || 'dark',
    ]);
    const row = await db.prepare(`SELECT * FROM signup_forms WHERE id = ?`).get([id]);
    res.status(201).json({ ...row, default_tags: normalizeArray(row.default_tags) });
  } catch (e) { next(e); }
});

router.patch('/forms/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { name, headline, subheadline, cta, placeholder, success_message, default_tags, style } = req.body || {};
    const existing = await db.prepare(`SELECT * FROM signup_forms WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`
      UPDATE signup_forms
      SET name = ?, headline = ?, subheadline = ?, cta = ?, placeholder = ?, success_message = ?, default_tags = ?::jsonb, style = ?
      WHERE id = ?
    `).run([
      name ?? existing.name,
      headline ?? existing.headline,
      subheadline ?? existing.subheadline,
      cta ?? existing.cta,
      placeholder ?? existing.placeholder,
      success_message ?? existing.success_message,
      default_tags !== undefined ? JSON.stringify(Array.isArray(default_tags) ? default_tags : []) : JSON.stringify(normalizeArray(existing.default_tags)),
      style ?? existing.style,
      req.params.id,
    ]);
    const row = await db.prepare(`SELECT * FROM signup_forms WHERE id = ?`).get([req.params.id]);
    res.json({ ...row, default_tags: normalizeArray(row.default_tags) });
  } catch (e) { next(e); }
});

router.delete('/forms/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const result = await db.prepare(`DELETE FROM signup_forms WHERE id = ?`).run([req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/submit/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const { email, name } = req.body || {};
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });

    const form = await db.prepare(`SELECT * FROM signup_forms WHERE id = ?`).get([req.params.id]);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE email = ?`).get([cleanEmail]);
    if (existing) {
      return res.json({ ok: true, message: form.success_message || 'Already subscribed.', duplicate: true });
    }

    const token = uuid();
    const tagsJson = typeof form.default_tags === 'string' ? form.default_tags : JSON.stringify(form.default_tags || []);
    const info = await db.prepare(`
      INSERT INTO newsletter_subscribers (email, name, source, tags, status, unsubscribe_token)
      VALUES (?, ?, ?, ?::jsonb, 'active', ?)
    `).run([cleanEmail, name || null, `form:${form.id}`, tagsJson, token]);

    await db.prepare(`UPDATE signup_forms SET signups_count = signups_count + 1 WHERE id = ?`).run([form.id]);
    const subscriber = await db.prepare(`SELECT * FROM newsletter_subscribers WHERE id = ?`).get([info.lastInsertRowid]);

    if (subscriber) sendWelcomeOne(subscriber).catch((err) => console.error('[signup:welcome1]', err.message));

    res.json({ ok: true, message: form.success_message || 'Welcome. Check your inbox.' });
  } catch (e) { next(e); }
});

async function sendWelcomeOne(subscriber) {
  const email = WELCOME_EMAILS[0];
  const md = personalize(email.markdown_body, subscriber);
  const html = renderNewsletterHtml({
    title: email.subject,
    markdown: md,
    subscriberEmail: subscriber.email,
    unsubscribeUrl: `${publicBaseUrl()}/api/subscribers/unsubscribe/${subscriber.unsubscribe_token}`,
    trackingPixelUrl: null,
  });
  const result = await sendEmail({
    to: subscriber.email,
    subject: email.subject,
    html,
    text: renderPlainText({ title: email.subject, markdown: md }),
    tags: [{ name: 'welcome_sequence', value: 'welcome_1' }],
  });
  if (result.delivered) {
    const db = openDb();
    await db.prepare(`UPDATE newsletter_subscribers SET welcome_email_1_sent_at = CURRENT_TIMESTAMP WHERE id = ?`).run([subscriber.id]);
  }
}

router.get('/page/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const form = await db.prepare(`SELECT * FROM signup_forms WHERE id = ?`).get([req.params.id]);
    if (!form) return res.status(404).send('Form not found.');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(hostedPageHtml(form));
  } catch (e) { next(e); }
});

function hostedPageHtml(form) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(form.headline || 'Subscribe')}</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
  background: #0a0a0a; color: #e0e0e0; padding: 24px;
}
.wrap { max-width: 480px; width: 100%; text-align: center; }
.kicker { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #666; font-weight: 600; margin-bottom: 16px; }
h1 { font-size: 28px; line-height: 1.25; font-weight: 700; color: #fff; margin-bottom: 12px; letter-spacing: -0.01em; }
p { color: #999; margin-bottom: 28px; line-height: 1.6; }
form { display: flex; flex-direction: column; gap: 10px; }
input { width: 100%; padding: 13px 16px; background: #141414; border: 1px solid #333; border-radius: 6px; font-size: 15px; color: #fff; font-family: inherit; }
input:focus { outline: none; border-color: #0066ff; }
button { padding: 13px 16px; background: #0066ff; color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
button:hover { background: #0052cc; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.msg { margin-top: 16px; font-size: 14px; }
.msg.ok { color: #00ff88; }
.msg.err { color: #ff4444; }
.foot { margin-top: 48px; font-size: 11px; color: #555; }
</style>
</head>
<body>
<div class="wrap">
  <div class="kicker">Roodjino Ch\u00e9rilus</div>
  <h1>${escapeHtml(form.headline)}</h1>
  ${form.subheadline ? `<p>${escapeHtml(form.subheadline)}</p>` : ''}
  <form id="f">
    <input type="email" name="email" placeholder="${escapeHtml(form.placeholder)}" required autocomplete="email">
    <input type="text" name="name" placeholder="Name (optional)" autocomplete="name">
    <button type="submit" id="b">${escapeHtml(form.cta)}</button>
  </form>
  <div id="m" class="msg"></div>
  <div class="foot">No spam. Unsubscribe anytime.</div>
</div>
<script>
const f = document.getElementById('f');
const m = document.getElementById('m');
const b = document.getElementById('b');
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  b.disabled = true; b.textContent = 'Submitting\u2026'; m.className = 'msg';
  const data = new FormData(f);
  try {
    const res = await fetch('/api/signup/submit/${form.id}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), name: data.get('name') }),
    });
    const j = await res.json();
    if (res.ok) { m.className = 'msg ok'; m.textContent = j.message || 'Welcome.'; f.reset(); }
    else { m.className = 'msg err'; m.textContent = j.error || 'Something went wrong.'; }
  } catch (err) { m.className = 'msg err'; m.textContent = 'Network error. Try again.'; }
  finally { b.disabled = false; b.textContent = '${escapeHtml(form.cta).replace(/'/g, "\\'")}'; }
});
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

module.exports = router;
