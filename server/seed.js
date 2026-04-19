// A dense, realistic 30-day content calendar.
// Targets (derived from strategy doc funnel coverage):
//   Discovery 6/wk, Authority 4/wk, Trust 3/wk, Conversion 2/wk, Identity 2/wk
// Platforms: LinkedIn, X, Instagram, Instagram Reels, TikTok, YouTube
// Narrative arc (15-day calendar logic from strategy doc):
//   Act 1 (Wk 1-2 roughly): The bet is paying off \u2014 credibility
//   Act 2 (Wk 2-3): This is what intelligence looks like \u2014 differentiation
//   Act 3 (Wk 3-4): You need to be inside this \u2014 desire + urgency

const CALENDAR_ITEMS = [
  // ===================== WEEK 1 \u2014 Foundation =====================
  // Mon
  {
    week: 1, day: 'Mon',
    title: 'X thread: The Architect Problem (teaser)',
    description: 'Open the week with a 5-tweet thread teasing the core thesis: founder invisibility is a pricing tax. Set up the LinkedIn essay coming Tuesday. Quotable lines, no hashtags.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Discovery',
  },
  // Tue
  {
    week: 1, day: 'Tue',
    title: 'The Architect Problem (LinkedIn essay)',
    description: 'The full flagship essay. Founder invisibility as a pricing tax. Frame the problem, name the mechanism, show one example from Banj Media. Land with the reader\u2019s own situation in mind.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Authority + Identity',
  },
  // Wed
  {
    week: 1, day: 'Wed',
    title: 'X standalone: Architect Problem quotable',
    description: 'One-tweet repurpose of the sharpest line from Tuesday\u2019s LinkedIn essay. Quotable, no hashtags.',
    content_type: 'x-standalone',
    platforms: ['X'],
    funnel_layer: 'Discovery',
  },
  {
    week: 1, day: 'Wed',
    title: 'Instagram carousel: Architect Problem visual',
    description: 'Visual version of Tuesday\u2019s argument. 7 slides: 1 cover, 4 step-through of the mechanism, 1 implication, 1 CTA. Keep the copy punchier than LinkedIn \u2014 visual-first.',
    content_type: 'carousel',
    platforms: ['Instagram'],
    funnel_layer: 'Authority',
  },
  // Thu
  {
    week: 1, day: 'Thu',
    title: 'Distribution > Production (LinkedIn essay)',
    description: 'Second flagship essay. The bottleneck shifted from creation to attention. Production quality is no longer the edge. Examples from Haitian market + one external reference.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Authority',
  },
  // Fri
  {
    week: 1, day: 'Fri',
    title: 'X thread: Architect + Distribution synthesis',
    description: 'Synthesize Tuesday + Thursday into a connective thread. Why the two ideas compound: an invisible founder in a distribution-bottleneck market pays double.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Authority',
  },
  // Sat
  {
    week: 1, day: 'Sat',
    title: 'Direct-to-camera shoot: Banj Media R&D',
    description: 'Internal shoot. Record 3 short clips (45-90s each) on: (1) what Banj built last quarter, (2) what broke, (3) what the lesson was for clients. Posts start Week 2.',
    content_type: 'video-shoot',
    platforms: ['TikTok', 'Instagram Reels'],
    funnel_layer: 'Trust',
  },
  // Sun
  {
    week: 1, day: 'Sun',
    title: 'Sunday reflection post (LinkedIn or X)',
    description: 'Short Identity post. What the week clarified. One honest line about building media infrastructure from Haiti. No lesson, no framework \u2014 just grounding.',
    content_type: 'linkedin-short',
    platforms: ['LinkedIn', 'X'],
    funnel_layer: 'Identity',
  },

  // ===================== WEEK 2 \u2014 Daily Clips Launch =====================
  // Mon
  {
    week: 2, day: 'Mon',
    title: 'Clip 1: AI exposes weak businesses',
    description: 'First clip from the R&D shoot. 60-90s direct-to-camera. Angle: AI commoditized speed. Judgment is now the moat. Most businesses had speed as their moat. They have 6 months.',
    content_type: 'video-clip',
    platforms: ['TikTok', 'Instagram Reels', 'LinkedIn'],
    funnel_layer: 'Discovery + Authority',
  },
  {
    week: 2, day: 'Mon',
    title: 'X thread: 3 ways AI reveals weak businesses',
    description: 'Thread version of Monday\u2019s clip. Name the three mechanisms. Link to the clip at the end.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Discovery + Authority',
  },
  // Tue
  {
    week: 2, day: 'Tue',
    title: 'LinkedIn post: Audience size is a lazy metric',
    description: 'Long-ish post (500-700 words). Rip into audience-size fetishism. Reframe: quality of attention > quantity of eyeballs. Use a specific Banj Media comparison to illustrate.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Authority',
  },
  // Wed
  {
    week: 2, day: 'Wed',
    title: 'Clip 2: Audience size is lazy',
    description: 'Short clip on audience-size-as-vanity-metric. Hook: \u201cEvery time someone tells me they have 50K followers I ask what the last month of revenue looks like. They get quiet.\u201d',
    content_type: 'video-clip',
    platforms: ['TikTok', 'Instagram Reels', 'X'],
    funnel_layer: 'Discovery',
  },
  {
    week: 2, day: 'Wed',
    title: 'Instagram caption: from a clip screenshot',
    description: 'Screenshot-aesthetic single post on Instagram (not carousel). Visual: a clean text-on-image with the Wed thread\u2019s sharpest line. Caption is the intellectual extension.',
    content_type: 'instagram-caption',
    platforms: ['Instagram'],
    funnel_layer: 'Discovery',
  },
  // Thu
  {
    week: 2, day: 'Thu',
    title: 'Clip 3: Banj Media failures as client intelligence',
    description: 'Trust-layer clip. Name one real thing Banj got wrong and the systems change it forced. Client-facing point: clients get the intelligence without paying the tuition.',
    content_type: 'video-clip',
    platforms: ['TikTok', 'Instagram Reels', 'LinkedIn'],
    funnel_layer: 'Trust',
  },
  // Fri
  {
    week: 2, day: 'Fri',
    title: 'X thread: Haiti punishes weak systems faster',
    description: 'Identity-adjacent thread. Frame Haiti as a diagnostic environment: if your system can operate here, it survives anywhere. Avoid hardship-porn framing \u2014 keep it operational.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Identity + Authority',
  },
  {
    week: 2, day: 'Fri',
    title: 'LinkedIn post: Legibility vs expertise',
    description: 'Medium-length LinkedIn post. Expertise alone doesn\u2019t move markets. Legibility is what makes expertise commercially operative. Contrast: the best operator in Port-au-Prince nobody can name.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Authority',
  },
  // Sat
  {
    week: 2, day: 'Sat',
    title: 'Instagram carousel: 5 signs your business is distribution-starved',
    description: '7-slide carousel. Framework-breakdown template. Each slide one symptom, final slide the diagnostic cue. Designed for forwarding.',
    content_type: 'carousel',
    platforms: ['Instagram', 'LinkedIn'],
    funnel_layer: 'Authority + Conversion',
  },
  // Sun
  {
    week: 2, day: 'Sun',
    title: 'Sunday reflection: the pattern in this week',
    description: 'Short piece pulling a thread through all 5 clips. What\u2019s the pattern you\u2019re noticing? Model reflection more than analysis.',
    content_type: 'linkedin-short',
    platforms: ['LinkedIn', 'X'],
    funnel_layer: 'Identity',
  },

  // ===================== WEEK 3 \u2014 YouTube Essay + Aggressive Distribution =====================
  // Mon
  {
    week: 3, day: 'Mon',
    title: 'YouTube essay: The Architect Problem (8-10 min)',
    description: 'The anchor long-form piece. Reads the Week 1 essay aloud with depth: history, examples from 2 industries (media + professional services), Haitian context, what to do.',
    content_type: 'youtube-essay',
    platforms: ['YouTube'],
    funnel_layer: 'Authority + Identity',
  },
  {
    week: 3, day: 'Mon',
    title: 'X thread: announcement of the essay',
    description: 'Teaser thread linking to the YouTube essay. One quote per tweet. Funnel people to watch.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Discovery',
  },
  // Tue
  {
    week: 3, day: 'Tue',
    title: 'Clip pack: 4 extracts from the YouTube essay',
    description: 'Cut 4 x 60-90s clips from Monday\u2019s essay. Each a standalone argument. Distribute across TikTok / Reels / LinkedIn / X over the next 3 days.',
    content_type: 'video-clip-pack',
    platforms: ['TikTok', 'Instagram Reels', 'X', 'LinkedIn'],
    funnel_layer: 'Discovery + Authority',
  },
  // Wed
  {
    week: 3, day: 'Wed',
    title: 'LinkedIn post: What clients think they\u2019re buying vs what they\u2019re actually buying',
    description: 'Conversion-layer post. Name the gap between stated scope and the real product. Where price lives. Use three buyer archetypes.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Conversion',
  },
  {
    week: 3, day: 'Wed',
    title: 'Instagram carousel: same topic, framework form',
    description: '8-slide carousel on the same thesis as Wed LinkedIn post. Template: side-by-side comparison slides. Last slide: who should book a call.',
    content_type: 'carousel',
    platforms: ['Instagram', 'LinkedIn'],
    funnel_layer: 'Conversion',
  },
  // Thu
  {
    week: 3, day: 'Thu',
    title: 'X thread: Legibility vs expertise (deep version)',
    description: 'Longer thread (7-10 tweets) than Week 2\u2019s post. Frame the specific mechanism: why markets price legibility over expertise. Three historical examples.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Discovery + Authority',
  },
  // Fri
  {
    week: 3, day: 'Fri',
    title: 'Direct-to-camera: Why communication infrastructure (not content)',
    description: 'Positioning video. 90s clip. Name the distinction between content shops and communication infrastructure. Banj\u2019s lane. Meant to land with buyers, not creators.',
    content_type: 'video-clip',
    platforms: ['LinkedIn', 'Instagram Reels', 'X'],
    funnel_layer: 'Conversion + Identity',
  },
  // Sat
  {
    week: 3, day: 'Sat',
    title: 'LinkedIn post: a small thing most teams get wrong',
    description: 'Short tactical post (300-400 words). Pick one operational miss you see in most comms teams (SOPs, handoffs, measurement loop). Specific, actionable, no fluff.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Trust',
  },
  // Sun
  {
    week: 3, day: 'Sun',
    title: 'Sunday reflection: what Act 2 made clear',
    description: 'Identity post. What the last 21 days have crystallized. Moving from \u201cthis is real\u201d to \u201cthis is what intelligence looks like.\u201d',
    content_type: 'linkedin-short',
    platforms: ['LinkedIn', 'X'],
    funnel_layer: 'Identity',
  },

  // ===================== WEEK 4 \u2014 Conversion + Identity =====================
  // Mon
  {
    week: 4, day: 'Mon',
    title: 'Direct-to-camera: Who should work with Banj Media',
    description: 'Explicit conversion piece. Name the three buyer types this is for. Name the two buyer types this is NOT for. Qualifying clarity is itself a selling tool.',
    content_type: 'video-clip',
    platforms: ['LinkedIn', 'Instagram Reels', 'X'],
    funnel_layer: 'Conversion',
  },
  {
    week: 4, day: 'Mon',
    title: 'LinkedIn caption supporting Mon video',
    description: 'Caption that accompanies the video. Clear CTA: reply DM or book a call. No soft language.',
    content_type: 'linkedin-short',
    platforms: ['LinkedIn'],
    funnel_layer: 'Conversion',
  },
  // Tue
  {
    week: 4, day: 'Tue',
    title: 'Instagram carousel: 5 layers of modern communication infrastructure',
    description: 'Authority carousel. Name the stack: editorial / creative production / distribution / measurement / commercial. One slide per layer, final slide: which layer breaks first without infrastructure.',
    content_type: 'carousel',
    platforms: ['Instagram', 'LinkedIn'],
    funnel_layer: 'Authority',
  },
  // Wed
  {
    week: 4, day: 'Wed',
    title: 'LinkedIn long post: Case study / client transformation',
    description: 'Name a real client situation (or a composite if confidentiality matters): the state before, what we built, the named outcome. Numbers. Concrete. The Trust + Conversion bridge.',
    content_type: 'linkedin-long',
    platforms: ['LinkedIn'],
    funnel_layer: 'Trust + Conversion',
  },
  // Thu
  {
    week: 4, day: 'Thu',
    title: 'X thread: 5 lessons from the case study',
    description: 'Thread derived from Wed\u2019s post. Each tweet one lesson, one-liner format. Link to full post last tweet.',
    content_type: 'x-thread',
    platforms: ['X'],
    funnel_layer: 'Authority',
  },
  // Fri
  {
    week: 4, day: 'Fri',
    title: 'X thread/post: Building in Haiti (reflection)',
    description: 'Identity piece. Longer than the Sunday reflections. The ongoing story of building media infrastructure from Haiti, on Haitian terms. Honest. No hero framing.',
    content_type: 'x-thread',
    platforms: ['X', 'LinkedIn'],
    funnel_layer: 'Identity',
  },
  // Sat
  {
    week: 4, day: 'Sat',
    title: 'Direct-to-camera: quick tactical clip',
    description: 'Short clip. Pick one tactical principle (e.g. \u201ckill every meeting that can be an SOP\u201d). Visual + spoken. 45-60s.',
    content_type: 'video-clip',
    platforms: ['TikTok', 'Instagram Reels', 'X'],
    funnel_layer: 'Discovery + Trust',
  },
  // Sun
  {
    week: 4, day: 'Sun',
    title: 'Month-end reflection + Week 5 tease',
    description: 'Sunday close. What the month made clear. One line hinting at what Week 5 expands on. Good for building the longitudinal follower who converts high.',
    content_type: 'linkedin-short',
    platforms: ['LinkedIn', 'X'],
    funnel_layer: 'Identity',
  },
];

// April 8, 2026 platform snapshot from the strategy doc — real historical reference
// point. Seeded as week_start '2026-04-06' (Monday of that week) so the first
// user-entered week produces a two-point trendline out of the box.
const BASELINE_METRICS = [
  { platform: 'Instagram', followers: 4212, posts_count: null, reach: 23000, engagement_total: null, notes: '~23K monthly reach (strategy doc baseline)' },
  { platform: 'Facebook', followers: 6027, posts_count: 1, reach: null, engagement_total: null, notes: '~1 post/month (strategy doc baseline)' },
  { platform: 'LinkedIn', followers: 3043, posts_count: null, reach: null, engagement_total: null, notes: 'Impressions +187.5% when active (baseline)' },
  { platform: 'TikTok', followers: 2200, posts_count: null, reach: 117, engagement_total: null, notes: 'Declining, ~117 views/week (baseline)' },
  { platform: 'X', followers: 1200, posts_count: null, reach: null, engagement_total: null, notes: 'Impressions +172%, engagement +266% (baseline)' },
  { platform: 'YouTube', followers: 730, posts_count: 0, reach: null, engagement_total: null, notes: 'Dormant, 15.9K lifetime views (baseline)' },
];
const BASELINE_WEEK_START = '2026-04-06';

function seedCalendar(db) {
  const insert = db.prepare(`
    INSERT INTO content_calendar (week, day, title, description, content_type, platforms, funnel_layer, status)
    VALUES (@week, @day, @title, @description, @content_type, @platforms, @funnel_layer, 'planned')
  `);
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      insert.run({
        ...row,
        platforms: JSON.stringify(row.platforms),
      });
    }
  });
  tx(CALENDAR_ITEMS);
}

function seedBaselineMetrics(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM performance_metrics').get().n;
  if (count > 0) return 0;
  const insert = db.prepare(`
    INSERT INTO performance_metrics (week_start, platform, followers, posts_count, reach, engagement_total, notes)
    VALUES (@week_start, @platform, @followers, @posts_count, @reach, @engagement_total, @notes)
  `);
  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run({ week_start: BASELINE_WEEK_START, ...row });
  });
  tx(BASELINE_METRICS);
  return BASELINE_METRICS.length;
}

module.exports = { seedCalendar, seedBaselineMetrics, CALENDAR_ITEMS, BASELINE_METRICS };
