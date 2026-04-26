/**
 * Platform-styled preview pane for the ContentEditor.
 *
 * Why bother with a visual preview vs just a character count: line-break
 * rendering, "see more" truncation, and tweet-thread break boundaries
 * are visible properties of the post that change how it lands. A user
 * looking at plain editor text systematically over-estimates how much
 * lands above the fold. Showing the post the way readers will see it
 * removes that surprise.
 *
 * Scope is intentionally limited:
 *   - LinkedIn  : truncation at 210 chars + "see more" rendering
 *   - X         : 280-char tweet boundaries; threads break visually
 *   - Instagram : 125-char caption truncation
 *   - Default   : fall back to plain text + char count
 *
 * No avatar API, no real timestamps. Just enough chrome that the user
 * recognizes the platform shape; not so much that we mislead them
 * about how the actual post will render.
 */

const SOFT_LIMITS = {
  LinkedIn: 3000,
  X: 280,
  Instagram: 2200,
  'Instagram Reels': 2200,
  TikTok: 2200,
  YouTube: 5000,
};

const TRUNCATE_AT = {
  LinkedIn: 210,
  Instagram: 125,
  'Instagram Reels': 125,
  TikTok: 125,
};

export default function PostPreview({ body, platform, displayName }) {
  if (!body || body.trim().length === 0) {
    return (
      <div className="card-pad text-center text-sm text-text-secondary">
        Preview shows up here once you've drafted the post.
      </div>
    );
  }

  const name = (displayName && displayName.trim()) || 'Your name';
  const platformKey = (platform || 'LinkedIn').trim();

  if (platformKey === 'X') {
    return <XPreview body={body} name={name} />;
  }
  if (platformKey === 'LinkedIn') {
    return <LinkedInPreview body={body} name={name} />;
  }
  if (platformKey === 'Instagram' || platformKey === 'Instagram Reels' || platformKey === 'TikTok') {
    return <CaptionPreview body={body} name={name} platform={platformKey} />;
  }

  // YouTube / multi / unknown — just show the text with the soft limit.
  const limit = SOFT_LIMITS[platformKey];
  return (
    <div className="card-pad space-y-2">
      <PlatformHeader platform={platformKey} chars={body.length} limit={limit} />
      <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{body}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LinkedIn — truncation at ~210 chars with "see more"
// -----------------------------------------------------------------------------

function LinkedInPreview({ body, name }) {
  const trimmed = body.trim();
  const cutoff = TRUNCATE_AT.LinkedIn;
  const willTruncate = trimmed.length > cutoff;
  // LinkedIn's actual cutoff is ~210 characters but breaks at the nearest
  // sentence/space. We approximate by hard-cutting at cutoff for the
  // visual; the real cutoff is close enough for orientation purposes.
  const above = willTruncate ? trimmed.slice(0, cutoff) : trimmed;
  const below = willTruncate ? trimmed.slice(cutoff) : '';

  return (
    <div className="rounded-xl border border-border bg-[#1c1c1c] overflow-hidden">
      <PlatformHeader platform="LinkedIn" chars={trimmed.length} limit={SOFT_LIMITS.LinkedIn} />
      <div className="px-4 py-3 border-t border-border">
        {/* Author row */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-full bg-primary/30 flex items-center justify-center text-primary font-semibold text-xs">
            {name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-text-primary truncate">{name}</div>
            <div className="text-[11px] text-text-secondary">just now · 🌐</div>
          </div>
        </div>
        {/* Body */}
        <div className="text-[13px] text-text-primary whitespace-pre-wrap leading-relaxed">
          {above}
          {willTruncate && (
            <>
              <span className="opacity-50">… </span>
              <span className="text-text-secondary cursor-pointer">see more</span>
              <div className="mt-2 text-[11px] text-warning">
                ⚠ Hidden below the cutoff: {below.length} characters. The first ~{cutoff} chars must do the work.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// X — 280-char tweet boundaries; thread breakup if multi-tweet
// -----------------------------------------------------------------------------

function XPreview({ body, name }) {
  // Detect thread structure. If the body contains explicit [N/N] markers
  // (matching the x-thread format prompt), split there. Otherwise,
  // auto-split paragraphs at 280-char boundaries with hard cuts.
  const tweets = parseThread(body);
  return (
    <div className="space-y-2">
      <PlatformHeader platform="X" chars={body.length} limit={null} />
      {tweets.map((tweet, i) => {
        const overLimit = tweet.length > 280;
        return (
          <div key={i} className="rounded-xl border border-border bg-[#1c1c1c] px-4 py-3">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-full bg-primary/30 flex items-center justify-center text-primary font-semibold text-xs">
                {name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-primary truncate">{name}</div>
                <div className="text-[11px] text-text-secondary">@you · just now</div>
              </div>
              {tweets.length > 1 && (
                <div className="ml-auto text-[10px] font-mono text-text-secondary">{i + 1}/{tweets.length}</div>
              )}
            </div>
            <div className="text-[14px] text-text-primary whitespace-pre-wrap leading-relaxed">
              {tweet}
            </div>
            <div className={`mt-2 text-[11px] font-mono ${overLimit ? 'text-danger' : 'text-text-secondary'}`}>
              {tweet.length}/280 {overLimit && `· ${tweet.length - 280} over limit`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseThread(body) {
  // If the user wrote a thread with explicit [N/N] markers, split there.
  if (/\[\s*\d+\s*\/\s*\d+\s*\]/.test(body)) {
    return body
      .split(/\[\s*\d+\s*\/\s*\d+\s*\]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Otherwise treat as single tweet.
  return [body.trim()];
}

// -----------------------------------------------------------------------------
// Caption preview — Instagram / TikTok (125-char truncation)
// -----------------------------------------------------------------------------

function CaptionPreview({ body, name, platform }) {
  const cutoff = TRUNCATE_AT[platform] || 125;
  const trimmed = body.trim();
  const willTruncate = trimmed.length > cutoff;
  const above = willTruncate ? trimmed.slice(0, cutoff) : trimmed;
  const below = willTruncate ? trimmed.slice(cutoff) : '';
  return (
    <div className="rounded-xl border border-border bg-[#1c1c1c] overflow-hidden">
      <PlatformHeader platform={platform} chars={trimmed.length} limit={SOFT_LIMITS[platform]} />
      <div className="px-4 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/30 flex items-center justify-center text-primary font-semibold text-[10px]">
            {name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="text-[12px] font-semibold text-text-primary truncate">{name}</div>
        </div>
        <div className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap">
          <span className="font-semibold mr-1">{name.split(' ')[0]?.toLowerCase()}</span>
          {above}
          {willTruncate && (
            <>
              <span className="opacity-50">… </span>
              <span className="text-text-secondary cursor-pointer">more</span>
              <div className="mt-2 text-[11px] text-warning">
                ⚠ Hidden below the cutoff: {below.length} characters. The first ~{cutoff} chars must do the work.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Header bar above each preview — character count + soft limit pressure
// -----------------------------------------------------------------------------

function PlatformHeader({ platform, chars, limit }) {
  const overLimit = limit != null && chars > limit;
  const nearLimit = limit != null && chars > limit * 0.85;
  const pressureColor = overLimit ? 'text-danger' : nearLimit ? 'text-warning' : 'text-text-secondary';
  return (
    <div className="px-4 py-2 bg-[#0f0f0f] flex items-center justify-between gap-2">
      <div className="text-[11px] uppercase tracking-widest text-text-secondary">{platform} · preview</div>
      <div className={`text-[11px] font-mono ${pressureColor}`}>
        {chars}{limit != null ? ` / ${limit}` : ''}
        {overLimit && ` · ${chars - limit} over`}
      </div>
    </div>
  );
}
