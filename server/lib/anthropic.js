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

// In-app Generate uses Opus 4.7 (top-tier quality).
// For heavy refinement, use the Copy Prompt button and iterate on claude.ai
// where Max/Pro gives unlimited Opus 4.7 flat-rate \u2014 avoids per-call API costs.
const MODEL = 'claude-opus-4-7';

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

async function generate({ type, platform, topic, tone, length, funnel_layer, extra }) {
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

  // Opus 4.7 deprecated the temperature parameter; omit for that family.
  // System prompt has two layers:
  //   1. Brand voice (cached — stable across all calls)
  //   2. User knowledge base (cached separately — changes when user edits KB)
  const kb = await getKnowledgeBaseBlock();
  const systemBlocks = [
    { type: 'text', text: BRAND_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (kb.text) {
    systemBlocks.push({ type: 'text', text: kb.text, cache_control: { type: 'ephemeral' } });
  }

  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: [
      { role: 'user', content: userMessage },
    ],
  };
  if (!MODEL.startsWith('claude-opus-4-7')) {
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
