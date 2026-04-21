const Anthropic = require('@anthropic-ai/sdk');
const {
  BRAND_SYSTEM_PROMPT,
  TEMPERATURE_BY_TYPE,
  MAX_TOKENS_BY_TYPE,
  buildUserMessage,
} = require('./prompts');
const { query } = require('./db');

// Fetch active KB entries + format them for system prompt injection.
// Cached for 60s since they change infrequently.
let kbCache = { text: '', at: 0, tokenCount: 0 };
async function getKnowledgeBaseBlock() {
  if (Date.now() - kbCache.at < 60_000) return kbCache;
  try {
    const rows = await query(`
      SELECT title, category, content_md, token_estimate
      FROM knowledge_base
      WHERE is_active = TRUE
      ORDER BY
        CASE category
          WHEN 'positioning' THEN 1
          WHEN 'voice' THEN 2
          WHEN 'framework' THEN 3
          WHEN 'project' THEN 4
          WHEN 'client' THEN 5
          WHEN 'haiti' THEN 6
          ELSE 9
        END,
        updated_at DESC
    `);
    if (rows.length === 0) {
      kbCache = { text: '', at: Date.now(), tokenCount: 0 };
      return kbCache;
    }
    const blocks = rows.map((r) => `### ${r.title} (${r.category})\n${r.content_md}`).join('\n\n---\n\n');
    const wrapped = `\n\n===============================\n# USER-SPECIFIC CONTEXT (living knowledge base)\n===============================\n\nThe following is context Roodjino has added himself. Use it as authoritative when it conflicts with general assumptions. Reference specifics from here when generating content — this is what makes the output not-generic.\n\n${blocks}\n\n===============================\n# END USER CONTEXT\n===============================`;
    const tokenCount = Math.ceil(wrapped.length / 4);
    kbCache = { text: wrapped, at: Date.now(), tokenCount };
    return kbCache;
  } catch (err) {
    console.warn('[kb] fetch failed:', err.message);
    return { text: '', at: Date.now(), tokenCount: 0 };
  }
}
function invalidateKbCache() { kbCache = { text: '', at: 0, tokenCount: 0 }; }

// Default model for original long-form creative work (Generate, Plan, Brainstorm,
// Briefing, Deepen, Carousels, Newsletter expand). Opus 4.7 is top-tier quality.
const MODEL = 'claude-opus-4-7';
// Lightweight model for structured extraction, classification, templating.
// Haiku 4.5 is ~5x cheaper on input and ~5x cheaper on output than Opus 4.7
// and handles JSON extraction / short personalization / gaps analysis just fine.
const HAIKU_MODEL = 'claude-haiku-4-5';

// Resolve a model override keyword to the actual model ID. Accepts:
//   - undefined / 'opus'  → default Opus 4.7
//   - 'haiku'             → Haiku 4.5
//   - an explicit model ID string → passed through verbatim (escape hatch)
function resolveModel(override) {
  if (!override || override === 'opus') return MODEL;
  if (override === 'haiku') return HAIKU_MODEL;
  return override;
}

let client = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
    }
    client = new Anthropic.default({ apiKey });
  }
  return client;
}

async function generate({ type, platform, topic, tone, length, funnel_layer, extra, model }) {
  const normalizedType = type || 'linkedin-short';
  const userMessage = buildUserMessage({
    type: normalizedType,
    platform,
    topic,
    tone,
    length,
    funnel_layer,
    extra,
  });
  const maxTokens = MAX_TOKENS_BY_TYPE[normalizedType] || 1500;
  const temperature = TEMPERATURE_BY_TYPE[normalizedType] ?? 0.7;
  const resolvedModel = resolveModel(model);

  // System prompt has two layers:
  //   1. Brand voice (cached — stable across all calls, same voice on Haiku or Opus)
  //   2. User knowledge base (cached separately — changes when user edits KB)
  // Caches are per-model, so Haiku and Opus warm independently. This is fine:
  // outreach personalization is bursty (many calls in a session → warm cache),
  // and weekly tasks amortize the cache write against cheaper per-token rates.
  const kb = await getKnowledgeBaseBlock();
  const systemBlocks = [
    { type: 'text', text: BRAND_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (kb.text) {
    systemBlocks.push({ type: 'text', text: kb.text, cache_control: { type: 'ephemeral' } });
  }

  const params = {
    model: resolvedModel,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: [
      { role: 'user', content: userMessage },
    ],
  };
  // Opus 4.7 removed the temperature parameter entirely; any other model
  // (Haiku 4.5, Sonnet 4.6, etc.) still accepts it.
  if (!resolvedModel.startsWith('claude-opus-4-7')) {
    params.temperature = temperature;
  }

  const response = await getClient().messages.create(params);

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return {
    text,
    model: response.model,
    usage: response.usage,
    stop_reason: response.stop_reason,
  };
}

async function healthCheck() {
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'reply with the single word: ok' }],
    });
    const text = response.content.map((b) => b.text || '').join('').trim().toLowerCase();
    return { ok: text.includes('ok'), model: response.model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { generate, healthCheck, MODEL, invalidateKbCache, getKnowledgeBaseBlock };
