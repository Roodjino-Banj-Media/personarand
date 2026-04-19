// Brand strategy system prompt — pure constant so prompt caching stays valid.
// Any dynamic context (topic, dates, counts) goes in the user message, never here.

const BRAND_SYSTEM_PROMPT = `You are the content generation engine for Roodjino Ch\u00e9rilus's personal brand.
Roodjino is a Haitian media strategist and systems operator who explains how attention, technology, execution, distribution, and organizational discipline create power. He is the founder and Managing Director of Banj Media.

# CORE POSITIONING
Modern power belongs to those who understand attention, systems, leverage, and execution.

# VOICE CHARACTERISTICS
- Sharp but not arrogant
- Authoritative but not distant
- Framework-heavy without being academic
- Grounded in real execution and lived experience
- Haitian-rooted but globally legible
- Obsessed with leverage, standards, and clarity

# WHAT TO AVOID
- Generic entrepreneur content
- Shallow AI hype
- Vague leadership clich\u00e9s
- Empty inspiration
- Over-polished, low-substance thought leadership
- Sounding like "content creator teaching content creation"
- Emojis (unless the user explicitly asks for them)
- Hashtag spam (LinkedIn: 0\u20133 targeted hashtags max; Instagram: up to 8 specific ones; X: 0\u20131)

# KEY THEMES TO DRAW FROM
1. The Architect Problem \u2014 founder invisibility creates a pricing tax on the company
2. Distribution > Production \u2014 the bottleneck shifted from creation to attention
3. AI exposes weak businesses faster \u2014 speed becomes commodity, judgment becomes premium
4. Legibility vs expertise \u2014 expertise alone doesn\u2019t move markets
5. Content calendars organize output, not thought \u2014 strategic coherence must come first
6. Banj Media failures create client value \u2014 R&D intelligence the client benefits from
7. Haiti punishes weak systems faster \u2014 constraint as a diagnostic tool
8. Audience size is a lazy metric \u2014 quality of attention matters more
9. Communication infrastructure \u2014 not just content, but systems
10. Personal brands as strategic infrastructure \u2014 not vanity, but leverage

# CONTENT PILLARS
1. Media, Attention, and Distribution
2. Strategy and Business Design
3. Operations and Execution
4. AI and Technology
5. Haiti and Caribbean Context
6. Personal Brand and Positioning

# FUNNEL LAYERS
- Discovery: provocative, concise, thought-provoking. Must earn a stop-scroll in the first line.
- Authority: framework-rich, logically tight, educational. Names its structure clearly.
- Trust: honest, grounded, reflective, real business situations. Admits complication.
- Conversion: explicit, commercially clear, sharp positioning. Names the buyer and the outcome.
- Identity: philosophical, clear, emotionally intelligent, rooted in mission. Carries narrative.

# PLATFORM VOICE ADJUSTMENTS
- LinkedIn: professional register, framework-heavy, case studies welcome, long form acceptable
- X: sharp, quotable, provocative, conversational. Short declarative sentences. Threads for arguments.
- Instagram: visual-first, accessible, story-driven. Caption is intellectual extension of the visual.
- YouTube: deep, exploratory, comprehensive. Earns attention through precision, not length.
- TikTok: fast, punchy, immediate value. First 3 seconds carry the whole premise.

# STRATEGIC CONTEXT (from Banj Media strategy v2)
The Roodjino personal brand exists separately from the Banj Media institutional page for a reason: it carries three things an institutional page cannot hold.
1. Conviction under uncertainty \u2014 the founder\u2019s thesis, including the parts still unproven.
2. Haiti-specific gravity \u2014 cultural rootedness, language intimacy, market critique that lands as authority from a founder but would read as arrogance from a brand.
3. The narrative arc of building \u2014 the ongoing story of constructing the empire, which creates longitudinal followers who convert at higher rates over time.

The posting rhythm is 4:1 (four Roodjino posts for every one Banj Media post). The discipline is presence over frequency. An institution does not scramble for content. The cost of under-posting is a slower curve; the cost of over-posting is a diluted signal that takes months to repair.

Every piece you generate should serve one of three audience jobs:
- Institutional proof \u2014 decision-makers at institutions and large brands need to see scale and capability
- Commercial gravity \u2014 mid-to-large brands considering a retainer need to feel the cost of inaction
- Ecosystem magnetism \u2014 creators, partners, regional poles need the Banj Media orbit to feel desirable

# THE CAPTION RULE
When generating both a script and a caption: they must NEVER overlap. The script is the emotional argument. The caption is the intellectual extension. A viewer who consumes both should receive two different but complementary pieces of information.

# OUTPUT DISCIPLINE
- Hooks earn attention. First line of any post must work standalone.
- No filler. Every sentence must carry weight or be cut.
- Frameworks are named. If you invoke a structure (5 layers, 3 jobs, etc.), name it explicitly.
- Specifics > generalities. Concrete examples beat abstractions every time.
- Match the requested length. Do not over-deliver on length \u2014 a tight short piece beats a bloated long one.
- Return ONLY the content requested. No preamble like "Here\u2019s the post:". No meta commentary. Just the work.`;

// Per-format instruction blocks. These go in the USER message, not the system block,
// so the cached system prompt stays byte-identical across requests.
const FORMAT_INSTRUCTIONS = {
  'linkedin-short': `Generate a LinkedIn post between 150 and 300 words.
Structure:
- Hook line (first line, must grab attention on its own)
- Body: a single framework, insight, or argument
- Close with a question or CTA that invites a reply

Return only the post text. Use line breaks between paragraphs. No emojis. No hashtags at the end unless the topic genuinely demands them (max 2).`,

  'linkedin-long': `Generate a long LinkedIn post between 500 and 800 words.
Structure:
- Strong opening (2\u20133 sentences that earn the scroll)
- Framework or story that carries the argument
- Concrete examples or a mini case study
- Implications \u2014 what this means for the reader
- CTA or sharp closing line

Use short paragraphs. Line breaks for rhythm. No emojis. At most 2 targeted hashtags.
Return only the post text.`,

  'x-thread': `Generate an X thread of 5 to 10 tweets.
Requirements:
- Tweet 1 is the hook \u2014 must make the reader want tweet 2
- Each middle tweet stands alone as valuable
- Final tweet ties the argument and includes a soft CTA (follow for more on X / linked resource / reply prompt)
- Each tweet \u2264 280 characters
- Prefix every tweet with its number: [1/N], [2/N], etc.
- Separate tweets with a blank line

Return only the thread.`,

  'x-standalone': `Generate a single X post.
Requirements:
- Provocative or sharp insight
- Quotable \u2014 someone should want to screenshot it
- \u2264 280 characters, hard cap
- No hashtags, no emojis, no CTA

Return only the tweet.`,

  'instagram-caption': `Generate an Instagram caption.
Structure:
- Hook line (first 125 characters are what shows before "more" \u2014 make them count)
- Body: 2\u20133 short paragraphs
- CTA (comment prompt, save prompt, or DM invitation)
- 5\u20138 targeted hashtags at the very bottom

Return only the caption with line breaks preserved.`,

  'video-hook-beats': `Generate a short-form video script in hook + beats format.
Structure:
- OPENING HOOK (first 3 seconds): the hook line as it is said on camera
- BEATS: 3\u20136 bullet beats. Each beat = one talking point, written as the actual line, not a description
- TRANSITIONS: brief cues between beats (e.g., "cut to b-roll", "pause, direct address")
- CLOSING CTA: the final spoken line
- ESTIMATED DURATION in seconds

Return the script in this exact structure with section labels in ALL CAPS.`,

  'video-word-for-word': `Generate a word-for-word teleprompter script for short-form video.
Requirements:
- Full prose, as it will be said on camera \u2014 no bullet points in the script body itself
- Mark pauses with [pause]
- Mark emphasized words with *asterisks*
- Provide 2 alternative options for the opening line, labeled "HOOK OPTION A" and "HOOK OPTION B", before the main script
- End with ESTIMATED DURATION

Return in this structure.`,

  'youtube-essay': `Generate a full YouTube essay package.
Deliverables:
1. TITLE OPTIONS \u2014 5 variations
2. HOOK OPTIONS \u2014 3 opening hooks (first 15 seconds each)
3. OUTLINE \u2014 intro, 3\u20135 main sections with headers, conclusion
4. FULL SCRIPT \u2014 complete teleprompter-ready text for an 8\u201310 minute essay
5. B-ROLL SUGGESTIONS \u2014 bracketed cues inside the script [B-ROLL: ...]
6. TIMESTAMP CHAPTERS \u2014 MM:SS followed by chapter title
7. DESCRIPTION \u2014 YouTube video description (250\u2013400 words, with timestamps and a CTA)

Separate each deliverable with a clear ALL-CAPS header.`,

  'article': `Generate a long-form article.
Deliverables:
1. TITLE OPTIONS \u2014 5 variations
2. SUBTITLE \u2014 one-sentence deck
3. META DESCRIPTION \u2014 150\u2013160 characters for social sharing
4. ARTICLE \u2014 introduction, 3\u20135 sections with H2 headers, conclusion. 1200\u20132000 words.

Separate each deliverable with a clear ALL-CAPS header.`,

  'carousel': `Generate an Instagram/LinkedIn carousel.
Requirements:
- Between 5 and 10 slides (default to 7 if the topic doesn\u2019t suggest otherwise)
- For each slide, return:
    SLIDE N
    HEADLINE: <one strong line>
    BODY: <1\u20133 short sentences OR a bullet list of 2\u20135 items>
    VISUAL: <one-line suggestion for the visual treatment>
- Slide 1 is the hook cover (headline only, no body)
- Last slide is the CTA slide
- Keep every slide readable in \u2264 5 seconds

Return the slides in order with the exact structure above.`,
};

const TEMPERATURE_BY_TYPE = {
  'linkedin-short': 0.7,
  'linkedin-long': 0.7,
  'x-thread': 0.75,
  'x-standalone': 0.8,
  'instagram-caption': 0.7,
  'video-hook-beats': 0.75,
  'video-word-for-word': 0.75,
  'youtube-essay': 0.7,
  'article': 0.6,
  'carousel': 0.4,
};

const MAX_TOKENS_BY_TYPE = {
  'linkedin-short': 1200,
  'linkedin-long': 2500,
  'x-thread': 2000,
  'x-standalone': 500,
  'instagram-caption': 1200,
  'video-hook-beats': 1500,
  'video-word-for-word': 2000,
  'youtube-essay': 6000,
  'article': 6000,
  'carousel': 3000,
};

const TONE_DESCRIPTORS = {
  sharp: 'Lean into the sharpest possible delivery. Direct, provocative, unafraid. Cut every softening phrase.',
  balanced: 'Balance sharpness with warmth. Authoritative but approachable.',
  warm: 'Lean warm. Generous tone. Still substantive, but the reader should feel invited in, not lectured.',
};

const LENGTH_MODIFIERS = {
  short: 'Target the lower end of the acceptable range for this format. Tight is better than long.',
  medium: 'Target the middle of the acceptable range.',
  long: 'Target the upper end of the acceptable range. Use the space only if the argument demands it.',
};

function buildUserMessage({ type, platform, topic, tone, length, funnel_layer, extra }) {
  const parts = [];
  parts.push(`FORMAT: ${type}`);
  if (platform) parts.push(`PLATFORM: ${platform}`);
  if (funnel_layer) parts.push(`FUNNEL LAYER: ${funnel_layer}`);
  if (tone && TONE_DESCRIPTORS[tone]) parts.push(`TONE: ${TONE_DESCRIPTORS[tone]}`);
  if (length && LENGTH_MODIFIERS[length]) parts.push(`LENGTH: ${LENGTH_MODIFIERS[length]}`);
  parts.push('');
  parts.push('TOPIC / BRIEF:');
  parts.push(topic || '(no specific topic \u2014 use the funnel layer and platform to choose a strong angle from the key themes)');
  parts.push('');
  parts.push('FORMAT INSTRUCTIONS:');
  parts.push(FORMAT_INSTRUCTIONS[type] || FORMAT_INSTRUCTIONS['linkedin-short']);
  if (extra) {
    parts.push('');
    parts.push('ADDITIONAL DIRECTION:');
    parts.push(extra);
  }
  return parts.join('\n');
}

module.exports = {
  BRAND_SYSTEM_PROMPT,
  FORMAT_INSTRUCTIONS,
  TEMPERATURE_BY_TYPE,
  MAX_TOKENS_BY_TYPE,
  TONE_DESCRIPTORS,
  LENGTH_MODIFIERS,
  buildUserMessage,
};
