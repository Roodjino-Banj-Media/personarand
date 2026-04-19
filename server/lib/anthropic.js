const Anthropic = require('@anthropic-ai/sdk');
const {
  BRAND_SYSTEM_PROMPT,
  TEMPERATURE_BY_TYPE,
  MAX_TOKENS_BY_TYPE,
  buildUserMessage,
} = require('./prompts');

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
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: BRAND_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
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

module.exports = { generate, healthCheck, MODEL };
