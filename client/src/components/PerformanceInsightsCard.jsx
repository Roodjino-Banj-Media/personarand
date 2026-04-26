import { useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Performance Insights — AI pattern analysis over rated/measured posts.
 *
 * Closes the feedback loop end-to-end: capture → generate → publish →
 * rate / measure → insights → adjust voice profile → next capture.
 *
 * Why opt-in (button-triggered) rather than auto-fetch on mount:
 *   - Each refresh spends Haiku tokens on a 25-post corpus.
 *   - The underlying data only changes when the user rates a post or
 *     enters metrics — there's no value re-running until they have.
 *   - The user controls when to get fresh insight, which keeps the
 *     widget feeling like a tool, not a chatty advisor.
 *
 * The card stays visible even before the threshold is met, surfacing
 * "X / 5 measured" as a soft prompt to keep entering metrics. Once
 * insights have been generated, they persist client-side until refresh
 * or page reload — no server-side cache.
 */

export default function PerformanceInsightsCard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.library.insights();
      setData(r);
    } catch (e) {
      setError(e.message || 'Insight generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-pad space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-text-secondary">Performance insights</div>
          <div className="text-sm font-semibold mt-1">What's working in your posts</div>
          <div className="text-[11px] text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Haiku reads your rated and measured posts and surfaces patterns you can act on. Closes the loop between what gets posted and what should be written next.
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs whitespace-nowrap"
          onClick={generate}
          disabled={busy}
          title="Re-analyze recent posts. Each refresh spends Haiku tokens — only refresh after you've rated or measured new posts."
        >
          {busy ? 'Analyzing…' : (data ? '↻ Re-analyze' : '✨ Generate insights')}
        </button>
      </div>

      {error && (
        <div className="text-xs text-warning">{error}</div>
      )}

      {data?.insufficient_data && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning leading-relaxed">
          {data.message}
          <span className="block mt-1 opacity-80">
            Currently: {data.count}/{data.threshold} posts have ratings or metrics.
          </span>
        </div>
      )}

      {data && !data.insufficient_data && (
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-secondary mb-1">Headline</div>
            <div className="text-sm text-text-primary leading-relaxed">{data.summary}</div>
            <div className="text-[10px] text-text-secondary mt-1 font-mono">
              {data.count} posts analyzed · generated {new Date(data.generated_at).toLocaleString()}
            </div>
          </div>

          {data.strong_patterns?.length > 0 && (
            <Section title="What's working" tone="success" items={data.strong_patterns} />
          )}
          {data.weak_patterns?.length > 0 && (
            <Section title="What's dragging" tone="warning" items={data.weak_patterns} />
          )}
          {data.experiments?.length > 0 && (
            <Section title="Experiments to try next" tone="primary" items={data.experiments} />
          )}
        </div>
      )}
    </div>
  );
}

const TONE_STYLES = {
  success: { container: 'border-success/40 bg-success/5', label: 'text-success' },
  warning: { container: 'border-warning/40 bg-warning/5', label: 'text-warning' },
  primary: { container: 'border-primary/40 bg-primary/5', label: 'text-primary' },
};

function Section({ title, tone, items }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.primary;
  return (
    <div className={`rounded-md border p-3 ${style.container}`}>
      <div className={`text-[11px] uppercase tracking-wider font-semibold ${style.label}`}>{title}</div>
      <ul className="mt-1.5 space-y-1.5 text-sm text-text-primary leading-relaxed">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-text-secondary flex-shrink-0">→</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
