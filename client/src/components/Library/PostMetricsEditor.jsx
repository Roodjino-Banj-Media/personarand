import { useState } from 'react';
import { api } from '../../lib/api.js';

/**
 * Inline per-post metrics editor.
 *
 * Manual entry today — the user reads numbers off LinkedIn / X /
 * Instagram and pastes here. Future LinkedIn API integration can
 * call /api/content/:id/metrics directly from the server with the
 * same payload shape, so the contract stays stable.
 *
 * The component supports two display modes:
 *   - Collapsed: a one-line summary "Reach 4,212 · 87 likes · 12 comments"
 *   - Expanded: 7 numeric inputs + Save button
 *
 * Engagement rate is computed inline (likes + comments + shares + saves) /
 * (reach || impressions). Calculator-style — not stored. We compute on
 * the fly so the user can see the rate update as they type.
 *
 * Save fires PATCH-style update via /api/content/:id/metrics. The
 * server stamps post_metrics_at on every successful write so the row
 * surfaces in dashboards as "recently measured".
 */

const FIELDS = [
  { key: 'reach',       label: 'Reach',       hint: 'Unique viewers' },
  { key: 'impressions', label: 'Impressions', hint: 'Total views (often > reach)' },
  { key: 'likes',       label: 'Likes',       hint: '' },
  { key: 'comments',    label: 'Comments',    hint: '' },
  { key: 'shares',      label: 'Shares',      hint: 'Reposts / retweets' },
  { key: 'saves',       label: 'Saves',       hint: 'Bookmarks' },
  { key: 'clicks',      label: 'Link clicks', hint: 'If a link was in the post' },
];

const SERVER_KEYS = {
  reach: 'post_reach',
  impressions: 'post_impressions',
  likes: 'post_likes',
  comments: 'post_comments',
  shares: 'post_shares',
  saves: 'post_saves',
  clicks: 'post_clicks',
};

export default function PostMetricsEditor({ row, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState(() => initFromRow(row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const summary = buildSummary(row);
  const hasMetrics = !!row.post_metrics_at;

  function setField(key, raw) {
    setVals((prev) => ({ ...prev, [key]: raw }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Build payload: empty strings → null (clear), valid numbers → int.
      const payload = {};
      for (const f of FIELDS) {
        const raw = vals[f.key];
        if (raw === '' || raw == null) {
          payload[f.key] = null;
        } else {
          const n = Number(String(raw).replace(/[,\s]/g, ''));
          if (!Number.isFinite(n) || n < 0) continue;
          payload[f.key] = Math.round(n);
        }
      }
      const updated = await api.library.metrics(row.id, payload);
      onUpdated?.(updated);
      setOpen(false);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-[11px] text-text-secondary">
      <div className="flex items-center gap-2 flex-wrap">
        {hasMetrics ? (
          <span className="font-mono text-text-primary">{summary}</span>
        ) : (
          <span className="italic">No metrics recorded</span>
        )}
        <button
          type="button"
          className="btn-ghost text-[11px]"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          {open ? 'Cancel' : (hasMetrics ? 'Edit metrics' : '📊 Add metrics')}
        </button>
        {hasMetrics && (
          <span className="text-[10px] opacity-60">measured {timeAgo(row.post_metrics_at)}</span>
        )}
      </div>

      {open && (
        <div
          className="mt-2 rounded-md border border-border bg-[#0f0f0f] p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[10px] uppercase tracking-wider text-text-secondary block">{f.label}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-base text-sm font-mono"
                  placeholder="—"
                  value={vals[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
                {f.hint && <div className="text-[10px] text-text-secondary mt-0.5">{f.hint}</div>}
              </div>
            ))}
          </div>
          <EngagementRateInline vals={vals} />
          {error && <div className="text-[11px] text-danger">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost text-xs" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="btn-primary text-xs" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save metrics'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EngagementRateInline({ vals }) {
  const num = (k) => {
    const n = Number(String(vals[k] || '').replace(/[,\s]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const denom = num('reach') || num('impressions');
  if (!denom) return null;
  const engagement = num('likes') + num('comments') + num('shares') + num('saves');
  const rate = (engagement / denom) * 100;
  return (
    <div className="text-[11px] text-text-secondary">
      Engagement rate: <span className="font-mono text-text-primary">{rate.toFixed(2)}%</span>
      <span className="ml-2 opacity-70">
        (likes+comments+shares+saves) ÷ {num('reach') ? 'reach' : 'impressions'}
      </span>
    </div>
  );
}

function initFromRow(row) {
  const out = {};
  for (const f of FIELDS) {
    const v = row[SERVER_KEYS[f.key]];
    out[f.key] = v == null ? '' : String(v);
  }
  return out;
}

function buildSummary(row) {
  const parts = [];
  const fmt = (n) => n != null ? Number(n).toLocaleString() : null;
  if (row.post_reach != null) parts.push(`Reach ${fmt(row.post_reach)}`);
  else if (row.post_impressions != null) parts.push(`${fmt(row.post_impressions)} imp.`);
  if (row.post_likes != null) parts.push(`${fmt(row.post_likes)} likes`);
  if (row.post_comments != null) parts.push(`${fmt(row.post_comments)} comments`);
  if (row.post_shares != null) parts.push(`${fmt(row.post_shares)} shares`);
  return parts.join(' · ') || '—';
}

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
