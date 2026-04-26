// Quick Capture — solo-operator quick-thought routing.
//
// The user dictates or types ANY thought from anywhere in the app via a
// floating mic button. Haiku reads it once and proposes:
//   1. A category (knowledge | post-idea | reactive | journal-note)
//   2. A title (short, specific)
//   3. A summary (one-line)
//   4. A KB category match (positioning | voice | framework | project | client | haiti | note)
//   5. A funnel layer (when post-idea/reactive)
//   6. A platform suggestion (when post-idea/reactive)
//
// The client uses this classification to render route options. The user
// confirms with one click, which calls the existing knowledge / calendar
// create endpoints — we don't duplicate those write paths here.
//
// Why a single classify endpoint instead of a router-style "save"
// endpoint: the user might want to override the AI's classification
// (e.g., "this looks like a post idea but I want it as a journal note").
// Returning a classification + suggested fields keeps the UI in control
// of the final write.

const express = require('express');
const {
  HAIKU_MODEL,
  getClient,
  humanizeAnthropicError,
} = require('../lib/anthropic');

const router = express.Router();

const CLASSIFY_SYSTEM_PROMPT = `You are a quick-capture classifier for a personal-brand operator. The user just dictated a thought, fact, observation, or note. Read it, decide what it is, and return strict JSON.

Categories:
- "knowledge"   — a stable fact, framework, project detail, or positioning point worth keeping in the AI's context for all future generations
- "post-idea"   — a thought that should become a planned post (LinkedIn, X, etc.)
- "reactive"    — a reaction to something happening NOW (news, a launch, someone's claim) that should be turned into a reactive post soon
- "journal"     — a private note, a diagnostic, an internal observation; not for publication

Return JSON only. No prose around it.`;

function buildClassifyMessage(text) {
  return `Classify this captured thought.

CAPTURED:
---
${text.trim()}
---

Return STRICT JSON of this exact shape:

{
  "category": "knowledge" | "post-idea" | "reactive" | "journal",
  "title": "<short specific title, 4–10 words>",
  "summary": "<one sentence>",
  "kb_category": "positioning" | "voice" | "framework" | "project" | "client" | "haiti" | "note",
  "funnel_layer": "Discovery" | "Authority" | "Trust" | "Conversion" | "Identity",
  "platform": "LinkedIn" | "X" | "Instagram" | "TikTok" | "YouTube",
  "rationale": "<one sentence — why this category over the alternatives>"
}

Rules:
- Pick the SINGLE best category. Don't hedge.
- Title should be specific enough to search for later — never "thought" or "note".
- For "knowledge" entries, choose the kb_category that fits best; for non-knowledge entries, return your best guess (it won't be used unless the user routes to KB).
- For "post-idea" / "reactive", funnel_layer + platform inform the calendar slot the UI will pre-fill.
- "rationale" is for the user to see — be honest about edge cases.

Output JSON only.`;
}

/** Tolerant JSON extractor, mirrors the one in voiceProfile.js. */
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  try { return JSON.parse(t); } catch { return null; }
}

router.post('/classify', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ error: 'text (10+ chars) required' });
    }
    const trimmed = text.trim().slice(0, 8000);

    let response;
    try {
      response = await getClient().messages.create({
        model: HAIKU_MODEL,
        max_tokens: 600,
        system: [{ type: 'text', text: CLASSIFY_SYSTEM_PROMPT }],
        messages: [{ role: 'user', content: buildClassifyMessage(trimmed) }],
        temperature: 0.2,
      });
    } catch (err) {
      console.warn('[quick-capture] classify failed:', err?.status, err?.message);
      throw humanizeAnthropicError(err);
    }

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const parsed = extractJson(raw);

    if (!parsed) {
      // Soft fallback — return a "journal" classification so the UI still
      // gives the user a save option. Better than blocking the capture.
      return res.json({
        category: 'journal',
        title: trimmed.slice(0, 60).replace(/\s+/g, ' '),
        summary: trimmed.slice(0, 140),
        kb_category: 'note',
        funnel_layer: 'Discovery',
        platform: 'LinkedIn',
        rationale: 'Classifier returned non-JSON output — defaulted to journal note.',
        full_content: trimmed,
        fallback: true,
      });
    }

    res.json({
      category: parsed.category || 'journal',
      title: parsed.title || trimmed.slice(0, 60).replace(/\s+/g, ' '),
      summary: parsed.summary || '',
      kb_category: parsed.kb_category || 'note',
      funnel_layer: parsed.funnel_layer || 'Discovery',
      platform: parsed.platform || 'LinkedIn',
      rationale: parsed.rationale || '',
      full_content: trimmed,
      model: response.model,
    });
  } catch (e) { next(e); }
});

module.exports = router;
