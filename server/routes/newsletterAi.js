const express = require('express');
const { openDb } = require('../db');
const { generate } = require('../lib/anthropic');

const router = express.Router();

router.post('/expand-from-social', async (req, res, next) => {
  try {
    const db = openDb();
    const { content_ids, template_type = 'deep_dive', tone = 'balanced' } = req.body || {};
    if (!Array.isArray(content_ids) || content_ids.length === 0) return res.status(400).json({ error: 'content_ids[] required' });

    const placeholders = content_ids.map((_, i) => `$${i + 1}`).join(',');
    const { query } = require('../lib/db');
    const pieces = await query(`
      SELECT gc.*, cc.funnel_layer AS calendar_funnel_layer, cc.title AS calendar_title
      FROM generated_content gc
      LEFT JOIN content_calendar cc ON cc.id = gc.calendar_id
      WHERE gc.id IN (${placeholders})
    `, content_ids);

    if (pieces.length === 0) return res.status(404).json({ error: 'no content found for those ids' });

    const templateGuide = {
      deep_dive: '1500-2000 word essay. Framework-heavy. Intro hook, framework explanation, 2-3 concrete examples from Banj Media or the Haitian market, actionable implications, sharp closing.',
      roundup: '800-1200 word weekly roundup. Quick commentary on each social post, the thread connecting them, a single takeaway readers can act on this week.',
      case_study: '1200-1800 words. Name a real situation (Banj Media project or client). Setup, tension, what was tried, what actually worked, what the reader should take.',
      bts: "1000-1500 words, first-person. Honest founder reflection. What you're actually building, what's hard about it, what you're learning. Concrete. No humble-brag.",
    };

    const sourceBlock = pieces.map((p, i) => `---
SOURCE POST ${i + 1}
Platform: ${p.platform || 'multi'}
Type: ${p.content_type || 'post'}
Funnel layer: ${p.calendar_funnel_layer || 'unspecified'}
Title: ${p.title || '(untitled)'}

${p.body || ''}
---`).join('\n\n');

    const topic = `Expand these ${pieces.length} social posts into a newsletter issue.\n\n${sourceBlock}\n\nFind the through-line that connects them. Do not just paraphrase — go deeper than the posts. Bring in frameworks, examples, and implications the posts couldn't hold.`;

    const extra = `FORMAT: markdown. Use # for the newsletter title, ## for sections, standard paragraphs for body. No preamble — return ONLY the markdown content.\nTEMPLATE GUIDE (${template_type}): ${templateGuide[template_type] || templateGuide.deep_dive}`;

    const result = await generate({
      type: 'article',
      platform: 'newsletter',
      topic, tone, length: 'long',
      funnel_layer: pieces[0]?.calendar_funnel_layer,
      extra,
    });
    res.json({ markdown: result.text, usage: result.usage, source_count: pieces.length });
  } catch (err) { next(err); }
});

router.post('/extract-social', async (req, res, next) => {
  try {
    const db = openDb();
    const { newsletter_id, markdown, count = 6 } = req.body || {};
    let content = markdown;
    if (!content && newsletter_id) {
      const issue = await db.prepare(`SELECT content_md FROM newsletter_issues WHERE id = ?`).get([newsletter_id]);
      content = issue?.content_md || '';
    }
    if (!content || content.length < 100) return res.status(400).json({ error: 'newsletter content is too short to extract from' });

    const topic = `Extract ${count} standalone social posts from this newsletter.\n\nNEWSLETTER:\n${content}\n\nEach post must work alone out of context of the newsletter. Do not simply quote sentences — rewrite where needed so each post carries its own premise and conclusion.`;

    const extra = `Return ONLY a JSON array. Each element:
{
  "idea": "short description",
  "x_standalone": "single tweet, <=280 chars, no hashtags",
  "linkedin_post": "150-300 word LinkedIn post with hook line and short paragraphs",
  "instagram_caption": "Instagram caption with hook, 2-3 short paragraphs, 5-7 relevant hashtags at the end"
}
No markdown code fences. Just the array.`;

    // Extraction is mechanical — Haiku handles JSON extraction well at ~5x lower cost.
    const result = await generate({ type: 'article', platform: 'multi', topic, tone: 'balanced', length: 'medium', extra, model: 'haiku' });
    let text = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let posts = [];
    try { posts = JSON.parse(text); } catch { return res.json({ posts: [], raw: result.text, usage: result.usage, parse_error: 'Could not parse JSON.' }); }
    res.json({ posts, usage: result.usage });
  } catch (err) { next(err); }
});

router.post('/subject-lines', async (req, res, next) => {
  try {
    const { markdown, title } = req.body || {};
    if (!markdown || markdown.length < 100) return res.status(400).json({ error: 'newsletter markdown too short' });

    const topic = `Generate 5 subject line options for this newsletter.\n\nTITLE: ${title || '(no title)'}\n\nNEWSLETTER:\n${markdown}`;
    const extra = `Return ONLY a JSON array with exactly 5 elements. Each element:
{
  "style": "curiosity" | "value" | "question" | "provocative" | "direct",
  "subject": "the subject line, <=70 chars",
  "predicted_open_rate": estimated open rate as a number between 25 and 55
}
No code fences, no commentary.`;

    // Subject-line variations are short, structured JSON — Haiku is plenty.
    const result = await generate({ type: 'article', platform: 'newsletter', topic, tone: 'sharp', length: 'short', extra, model: 'haiku' });
    let text = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let options = [];
    try { options = JSON.parse(text); } catch { return res.json({ options: [], raw: result.text, parse_error: 'Could not parse JSON' }); }
    res.json({ options, usage: result.usage });
  } catch (err) { next(err); }
});

module.exports = router;
