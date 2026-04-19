// Parse the AI's structured carousel output into an array of slide objects.
// Input format (produced by the carousel format instructions in prompts.js):
//
//   SLIDE 1
//   HEADLINE: ...
//   BODY: ...
//   VISUAL: ...
//
//   SLIDE 2
//   HEADLINE: ...
//   ...
//
// Output: [{ headline, body, visual }, ...]  (index is position in array)

function parseCarouselText(text) {
  if (!text || typeof text !== 'string') return [];

  const normalized = text.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/^\s*SLIDE\s+\d+\s*$/im).filter((b) => b.trim().length > 0);

  return blocks.map((block) => extractFields(block));
}

function extractFields(block) {
  const fields = { headline: '', body: '', visual: '' };
  const labels = ['HEADLINE', 'BODY', 'VISUAL'];
  // Only consume spaces/tabs after the colon \u2014 NOT newlines \u2014 so the
  // lookahead can still see the \n that precedes the next label. Without this,
  // "\s*:\s*" would eat the newline and the next field would be mis-captured.
  const pattern = new RegExp(
    `^[ \\t]*(${labels.join('|')})[ \\t]*:[ \\t]*([\\s\\S]*?)(?=\\n[ \\t]*(?:${labels.join('|')})[ \\t]*:|$)`,
    'gim'
  );
  let match;
  while ((match = pattern.exec(block)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'headline') fields.headline = value;
    else if (key === 'body') fields.body = value;
    else if (key === 'visual') fields.visual = value;
  }
  return fields;
}

module.exports = { parseCarouselText };
