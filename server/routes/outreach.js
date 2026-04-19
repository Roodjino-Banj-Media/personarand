const express = require('express');
const { openDb } = require('../db');
const { sendEmail, isConfigured } = require('../lib/email');
const { generate } = require('../lib/anthropic');

const router = express.Router();

function emailBodyToHtml(body) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.6; color:#222; white-space:pre-wrap;">${String(body || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
}

router.post('/ai-personalize', async (req, res, next) => {
  try {
    const db = openDb();
    const { prospect_id, template_id } = req.body || {};
    if (!prospect_id || !template_id) return res.status(400).json({ error: 'prospect_id + template_id required' });
    const prospect = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([prospect_id]);
    const template = await db.prepare(`SELECT * FROM email_templates WHERE id = ?`).get([template_id]);
    if (!prospect || !template) return res.status(404).json({ error: 'prospect or template not found' });

    const topic = `Personalize this email template for this prospect.

PROSPECT:
- Name: ${prospect.name}
- Company: ${prospect.company || 'unknown'}
- Title: ${prospect.title || 'unknown'}
- Industry: ${prospect.industry || 'unknown'}
- Pain points noted: ${prospect.pain_points || '(none recorded)'}
- LinkedIn / context: ${prospect.linkedin_context || '(none provided)'}
- Notes: ${prospect.notes || '(none)'}

TEMPLATE SUBJECT: ${template.subject_line}
TEMPLATE BODY:
${template.body}

Fill every {variable} in the template with the most specific, credible, grounded substitution possible from the prospect context.`;

    const extra = `Return ONLY a JSON object with two keys: "subject" and "body". No code fences.`;

    const result = await generate({ type: 'article', platform: 'email', topic, tone: 'sharp', length: 'short', extra });
    let text = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      const parsed = JSON.parse(text);
      res.json({ subject: parsed.subject, body: parsed.body, usage: result.usage });
    } catch {
      res.json({ subject: template.subject_line, body: template.body, raw: result.text, parse_error: true });
    }
  } catch (e) { next(e); }
});

router.post('/send', async (req, res, next) => {
  try {
    const db = openDb();
    const { prospect_id, template_id, subject, body, content_shared_id } = req.body || {};
    if (!prospect_id || !subject || !body) return res.status(400).json({ error: 'prospect_id, subject, body required' });

    const prospect = await db.prepare(`SELECT * FROM prospects WHERE id = ?`).get([prospect_id]);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });
    if (!prospect.email) return res.status(400).json({ error: 'Prospect has no email address' });

    const result = await sendEmail({
      to: prospect.email,
      subject,
      html: emailBodyToHtml(body),
      text: body,
      tags: [{ name: 'category', value: 'prospecting' }, { name: 'template_id', value: String(template_id || 'adhoc') }],
    });

    const info = await db.prepare(`
      INSERT INTO email_outreach (prospect_id, template_id, subject, body, resend_message_id, content_shared_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run([prospect_id, template_id || null, subject, body, result.id || null, content_shared_id || null]);

    if (template_id) {
      await db.prepare(`UPDATE email_templates SET times_used = times_used + 1 WHERE id = ?`).run([template_id]);
    }

    await db.prepare(`
      UPDATE prospects
      SET status = CASE WHEN status = 'cold' THEN 'contacted' ELSE status END,
          stage = CASE WHEN stage = 'prospecting' THEN 'contacted' ELSE stage END,
          last_contact = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run([prospect_id]);

    await db.prepare(`INSERT INTO engagement_events (entity_type, entity_id, event_type, event_data) VALUES (?, ?, ?, ?::jsonb)`)
      .run(['prospect', prospect_id, 'email_sent', JSON.stringify({ subject, template_id })]);

    res.json({ id: info.lastInsertRowid, configured: isConfigured(), delivered: result.delivered, reason: result.reason });
  } catch (err) { console.error('[outreach:send]', err); next(err); }
});

router.get('/daily-stats', async (req, res, next) => {
  try {
    const db = openDb();
    const today = await db.prepare(`
      SELECT
        COUNT(*) AS emails_today,
        COUNT(replied_at) AS responses_today,
        (SELECT COUNT(*) FROM meetings WHERE DATE(created_at) = CURRENT_DATE) AS meetings_booked_today
      FROM email_outreach
      WHERE DATE(sent_at) = CURRENT_DATE
    `).get();
    const week = await db.prepare(`
      SELECT COUNT(*) AS emails_week, COUNT(replied_at) AS responses_week
      FROM email_outreach WHERE sent_at >= NOW() - INTERVAL '7 days'
    `).get();
    const avg7 = Math.round((Number(week.emails_week) || 0) / 7);
    const responseRate = Number(week.emails_week) > 0 ? +(Number(week.responses_week) / Number(week.emails_week) * 100).toFixed(1) : null;
    res.json({
      emails_today: Number(today.emails_today),
      responses_today: Number(today.responses_today),
      meetings_booked_today: Number(today.meetings_booked_today),
      emails_week: Number(week.emails_week),
      responses_week: Number(week.responses_week),
      avg_7_day: avg7,
      response_rate_7d: responseRate,
    });
  } catch (e) { next(e); }
});

router.post('/:id/mark-replied', async (req, res, next) => {
  try {
    const db = openDb();
    const { reply_text } = req.body || {};
    const outreach = await db.prepare(`SELECT * FROM email_outreach WHERE id = ?`).get([req.params.id]);
    if (!outreach) return res.status(404).json({ error: 'Not found' });
    await db.prepare(`UPDATE email_outreach SET replied_at = CURRENT_TIMESTAMP, reply_text = ? WHERE id = ?`).run([reply_text || null, req.params.id]);
    if (outreach.template_id) {
      await db.prepare(`UPDATE email_templates SET times_replied = times_replied + 1 WHERE id = ?`).run([outreach.template_id]);
    }
    await db.prepare(`UPDATE prospects SET status = 'responded', stage = 'responded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run([outreach.prospect_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
