import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * AI Calibration card — Dashboard widget that surfaces the three feedback
 * signals feeding the AI feedback loop:
 *
 *   1. Strong-rated posts   — tonal reference; what Roodjino's audience responds to
 *   2. Active KB entries    — situational context; what Roodjino is actually working on
 *   3. Edit samples captured — corrective signal; what Roodjino changes from AI drafts
 *
 * Each metric has an explicit target (5 / 4 / 3) and a direct CTA. Together
 * they're what turn generic operator-class output into Roodjino-specific
 * output. Until the three targets are met, output quality is capped.
 *
 * Once all three thresholds are met, the widget collapses to a single-line
 * "✓ Calibrated" state so Roodjino still sees the health signal without
 * clutter.
 */

const TARGETS = {
  strong: 5,
  kb: 4,
  edits: 3,
};

export default function AICalibrationCard() {
  const [state, setState] = useState(null);

  async function load() {
    try {
      const [performers, kbResp, libRaw] = await Promise.all([
        api.library.topPerformers(50).catch(() => []),
        api.knowledge.list().catch(() => ({ entries: [] })),
        api.library.list().catch(() => []),
      ]);
      const strong = Array.isArray(performers) ? performers.length : 0;
      const kbActive = (kbResp?.entries || []).filter((e) => e.is_active).length;
      const edits = (libRaw || []).filter((r) => r.posted_version_en && r.posted_version_en !== r.body).length;
      setState({ strong, kbActive, edits });
    } catch {
      // If anything fails, just don't render — not worth alarming the user.
      setState(null);
    }
  }
  useEffect(() => { load(); }, []);

  if (!state) return null;

  const hits = {
    strong: state.strong >= TARGETS.strong,
    kb: state.kbActive >= TARGETS.kb,
    edits: state.edits >= TARGETS.edits,
  };
  const allHit = hits.strong && hits.kb && hits.edits;
  const hitCount = [hits.strong, hits.kb, hits.edits].filter(Boolean).length;
  const coldStart = state.strong === 0 && state.kbActive === 0 && state.edits === 0;

  // Compact "calibrated" state — still visible, no clutter.
  if (allHit) {
    return (
      <div className="card-pad border-success/30 bg-success/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span className="text-success font-semibold">✓ AI calibrated.</span>
          <span className="text-text-secondary ml-2">
            {state.strong} strong-rated · {state.kbActive} KB entries · {state.edits} edit samples.
            Every new generation inherits the signal.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-pad ${coldStart ? 'border-warning/40 bg-warning/5' : 'border-primary/30 bg-primary/5'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className={`font-semibold ${coldStart ? 'text-warning' : 'text-primary'}`}>
            {coldStart
              ? '⚠ AI calibration — cold start'
              : `AI calibration — ${hitCount} of 3 signals hit`}
          </div>
          <div className="text-text-secondary text-xs mt-1 max-w-3xl leading-relaxed">
            {coldStart
              ? 'The AI has no strong-rated posts, no Knowledge Base context, and no edit samples. Output will sound generic — it\'s writing with voice only. Three quick habits calibrate the system to your work.'
              : 'Output quality compounds as these signals fill in. Each generation reads all three, so every entry you add sharpens every future piece.'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <CalibrationMeter
          label="Strong-rated posts"
          current={state.strong}
          target={TARGETS.strong}
          hit={hits.strong}
          explanation="Posts you flagged 🔥. The AI references them as tonal ceiling on every new generation."
          cta="Rate your best posts"
          href="/library?sort=newest"
        />
        <CalibrationMeter
          label="Active KB entries"
          current={state.kbActive}
          target={TARGETS.kb}
          hit={hits.kb}
          explanation="Projects, clients, frameworks, Haiti context. The AI injects active entries into every call."
          cta="Seed the Knowledge Base"
          href="/knowledge"
        />
        <CalibrationMeter
          label="Edit samples captured"
          current={state.edits}
          target={TARGETS.edits}
          hit={hits.edits}
          explanation="When you edit an AI draft before posting, save the final version. The delta teaches the AI what you change."
          cta="Capture posted edits"
          href="/library?sort=newest&status=posted"
        />
      </div>
    </div>
  );
}

function CalibrationMeter({ label, current, target, hit, explanation, cta, href }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const barColor = hit ? 'bg-success' : current > 0 ? 'bg-primary' : 'bg-warning';
  const labelColor = hit ? 'text-success' : current > 0 ? 'text-primary' : 'text-warning';
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className={`text-xs font-semibold ${labelColor}`}>
          {hit && '✓ '}{label}
        </div>
        <div className="font-mono text-sm">
          <span className={labelColor}>{current}</span>
          <span className="text-text-secondary"> / {target}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#1f1f1f] overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] text-text-secondary mt-2 leading-relaxed">
        {explanation}
      </div>
      {!hit && (
        <a
          href={href}
          className="inline-block mt-2 text-xs text-primary hover:underline"
        >
          {cta} →
        </a>
      )}
    </div>
  );
}
