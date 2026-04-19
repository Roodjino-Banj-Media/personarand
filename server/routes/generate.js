const express = require('express');
const { openDb } = require('../db');
const { generate } = require('../lib/anthropic');

const router = express.Router();

router.post('/content', async (req, res, next) => {
  try {
    const { calendar_id, type, platform, topic, tone, length, funnel_layer, extra, save = true } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type is required' });

    const result = await generate({ type, platform, topic, tone, length, funnel_layer, extra });

    if (!save) return res.json({ text: result.text, usage: result.usage, saved: false });

    const db = openDb();
    const title = topic ? topic.slice(0, 120) : `${type} / ${platform || 'multi'}`;
    const metadata = JSON.stringify({
      tone, length, model: result.model, usage: result.usage, stop_reason: result.stop_reason,
    });
    const info = await db.prepare(`
      INSERT INTO generated_content (calendar_id, content_type, platform, title, body, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?::jsonb, 'draft')
    `).run([calendar_id || null, type, platform || null, title, result.text, metadata]);
    const row = await db.prepare('SELECT * FROM generated_content WHERE id = ?').get([info.lastInsertRowid]);
    res.json({ ...row, usage: result.usage, saved: true });
  } catch (err) { console.error('[generate]', err.message); next(err); }
});

module.exports = router;
