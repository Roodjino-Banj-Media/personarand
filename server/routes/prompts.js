const express = require('express');
const { BRAND_SYSTEM_PROMPT, buildUserMessage } = require('../lib/prompts');

const router = express.Router();

// Returns a paste-ready prompt for claude.ai (Max/Pro) or any other LLM interface.
// Same input shape as /api/generate/content so the client can hand the same
// payload to either endpoint.
router.post('/build', (req, res) => {
  const { type, platform, topic, tone, length, funnel_layer, extra } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type is required' });

  const user = buildUserMessage({ type, platform, topic, tone, length, funnel_layer, extra });

  // The "combined" version is a single paste — system prompt framed as context,
  // then a divider, then the user message. Works in any chat interface.
  const combined = [
    '=== SYSTEM PROMPT (brand voice + strategy) ===',
    '',
    BRAND_SYSTEM_PROMPT,
    '',
    '=== YOUR REQUEST ===',
    '',
    user,
  ].join('\n');

  res.json({
    system: BRAND_SYSTEM_PROMPT,
    user,
    combined,
  });
});

module.exports = router;
