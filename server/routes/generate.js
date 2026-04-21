const express = require('express');
const { openDb } = require('../db');
const { generate } = require('../lib/anthropic');
const { parseCarouselText } = require('../lib/carouselParser');
const { persistCarousel } = require('./carousels');

const router = express.Router();

router.post('/content', async (req, res, next) => {
  try {
    const {
      calendar_id,
      type,
      platform,
      topic,
      tone,
      length,
      funnel_layer,
      extra,
      save = true,
      bilingual = false,
    } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type is required' });

    const commonArgs = { type, platform, topic, tone, length, funnel_layer, extra, useFeedbackLoop: true };

    // Always generate English first. If bilingual is requested, then generate
    // French using the English draft as a structural reference. Sequential
    // (not parallel) so the FR call reads the brand-voice system prompt from
    // cache — saves ~90% on the cached input tokens the second time around.
    const enResult = await generate({ ...commonArgs, language: 'en' });

    let frResult = null;
    if (bilingual) {
      frResult = await generate({ ...commonArgs, language: 'fr', priorVersion: enResult.text });
    }

    if (!save) {
      return res.json({
        text: enResult.text,
        text_fr: frResult?.text || null,
        usage: enResult.usage,
        usage_fr: frResult?.usage || null,
        saved: false,
      });
    }

    const title = topic ? topic.slice(0, 120) : `${type} / ${platform || 'multi'}`;

    // Carousel: dual-write into both generated_content AND carousel_designs so
    // the row shows in the Library (with rating + feedback loop) AND as a
    // designable deck in the Carousel Studio. Before this, generating a
    // carousel from the calendar went into generated_content only and never
    // became an editable deck.
    if (type === 'carousel') {
      const slides = parseCarouselText(enResult.text);
      const { carousel, content } = await persistCarousel({
        title,
        slides,
        rawText: enResult.text,
        templateStyle: 'text-heavy',
        platform: platform || 'LinkedIn',
        funnelLayer: funnel_layer,
        calendarId: calendar_id || null,
        bodyFr: frResult?.text || null,
      });
      return res.json({ ...content, carousel_id: carousel.id, usage: enResult.usage, usage_fr: frResult?.usage || null, saved: true });
    }

    const db = openDb();
    // For the French title, take the first line of the French body if present.
    // Claude usually leads with a hook line that works as a title.
    const titleFr = frResult
      ? (frResult.text.split('\n').find((l) => l.trim().length > 0) || '').slice(0, 120)
      : null;
    const metadata = JSON.stringify({
      tone,
      length,
      model: enResult.model,
      usage: enResult.usage,
      usage_fr: frResult?.usage || null,
      stop_reason: enResult.stop_reason,
      bilingual,
    });
    const info = await db.prepare(`
      INSERT INTO generated_content (calendar_id, content_type, platform, title, body, title_fr, body_fr, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'draft')
    `).run([
      calendar_id || null,
      type,
      platform || null,
      title,
      enResult.text,
      titleFr,
      frResult?.text || null,
      metadata,
    ]);
    const row = await db.prepare('SELECT * FROM generated_content WHERE id = ?').get([info.lastInsertRowid]);
    res.json({ ...row, usage: enResult.usage, usage_fr: frResult?.usage || null, saved: true });
  } catch (err) {
    console.error('[generate]', err.message);
    next(err);
  }
});

module.exports = router;
