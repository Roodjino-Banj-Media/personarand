import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import TrendChart from './TrendChart.jsx';

const BASELINE = {
  Instagram: { followers: 4212, reach: 23000, note: '~23K monthly reach' },
  Facebook: { followers: 6027, note: '~1 post/month' },
  LinkedIn: { followers: 3043, note: 'Impressions +187.5% when active' },
  TikTok: { followers: 2200, note: 'Declining, ~117 views/week' },
  X: { followers: 1200, note: 'Impressions +172%, engagement +266%' },
  YouTube: { followers: 730, note: 'Dormant, 15.9K lifetime views' },
};

const PLATFORMS = Object.keys(BASELINE);

function thisMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function emptyEntry(platform) {
  const base = BASELINE[platform];
  return {
    platform,
    followers: base.followers ?? '',
    posts_count: '',
    reach: '',
    engagement_total: '',
    top_post_link: '',
    notes: '',
  };
}

export default function MetricsForm() {
  const [weekStart, setWeekStart] = useState(thisMonday());
  const [entries, setEntries] = useState(PLATFORMS.map(emptyEntry));
  const [history, setHistory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [health, setHealth] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [chartMetric, setChartMetric] = useState('followers');

  async function loadAll() {
    try {
      const [rows, tr, hl] = await Promise.all([
        api.metrics.list(),
        api.metrics.trends(),
        api.metrics.health(),
      ]);
      setHistory(rows || []);
      setTrends(tr || []);
      setHealth(hl || {});
    } catch (err) {
      console.error('failed to load metrics data', err);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function update(platform, field, value) {
    setEntries((prev) => prev.map((e) => e.platform === platform ? { ...e, [field]: value } : e));
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const payload = {
        week_start: weekStart,
        entries: entries.map((e) => ({
          ...e,
          followers: numOrNull(e.followers),
          posts_count: numOrNull(e.posts_count),
          reach: numOrNull(e.reach),
          engagement_total: numOrNull(e.engagement_total),
        })),
      };
      const res = await api.metrics.save(payload);
      setSavedMsg(`Saved ${res.inserted} platform rows for ${weekStart}`);
      await loadAll();
    } catch (err) {
      setSavedMsg(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Metrics</h1>
        <p className="text-text-secondary text-sm mt-1">
          Baseline pre-filled from the April 8, 2026 snapshot. Overwrite with current numbers.
        </p>
      </div>

      <HealthAlerts health={health} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="section-title !mb-0">Trend</div>
          <div className="flex rounded-md border border-border overflow-hidden">
            {['followers', 'reach', 'engagement'].map((m) => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  chartMetric === m ? 'bg-primary text-white' : 'bg-card text-text-secondary hover:bg-[#1f1f1f]'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <TrendChart trends={trends} platforms={PLATFORMS} metric={chartMetric} height={260} />
      </section>

      <div className="card-pad">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="label">Week starting</div>
            <input
              type="date"
              className="input w-44"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save week'}
          </button>
          {savedMsg && <div className="text-xs text-text-secondary">{savedMsg}</div>}
        </div>
      </div>

      <div className="card overflow-x-auto -mx-4 md:mx-0 rounded-none md:rounded-lg">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-text-secondary">
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3">Platform</th>
              <th className="text-right px-3 py-3">Followers</th>
              <th className="text-right px-3 py-3">Posts</th>
              <th className="text-right px-3 py-3">Reach</th>
              <th className="text-right px-3 py-3">Engagement</th>
              <th className="text-left px-3 py-3">Top post link</th>
              <th className="text-left px-3 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.platform} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2 font-medium">
                  <div>{e.platform}</div>
                  <div className="text-[11px] text-text-secondary font-normal">{BASELINE[e.platform].note}</div>
                </td>
                <td className="px-3 py-2 text-right"><NumInput v={e.followers} set={(v) => update(e.platform, 'followers', v)} /></td>
                <td className="px-3 py-2 text-right"><NumInput v={e.posts_count} set={(v) => update(e.platform, 'posts_count', v)} /></td>
                <td className="px-3 py-2 text-right"><NumInput v={e.reach} set={(v) => update(e.platform, 'reach', v)} /></td>
                <td className="px-3 py-2 text-right"><NumInput v={e.engagement_total} set={(v) => update(e.platform, 'engagement_total', v)} /></td>
                <td className="px-3 py-2"><input className="input py-1 text-xs" value={e.top_post_link} onChange={(ev) => update(e.platform, 'top_post_link', ev.target.value)} /></td>
                <td className="px-3 py-2"><input className="input py-1 text-xs" value={e.notes} onChange={(ev) => update(e.platform, 'notes', ev.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <div className="section-title">History (most recent first)</div>
        {history.length === 0 ? (
          <div className="card-pad text-text-secondary text-sm">No weeks saved yet.</div>
        ) : (
          <div className="card overflow-x-auto -mx-4 md:mx-0 rounded-none md:rounded-lg">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-text-secondary">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2">Week</th>
                  <th className="text-left px-3 py-2">Platform</th>
                  <th className="text-right px-3 py-2">Followers</th>
                  <th className="text-right px-3 py-2">Posts</th>
                  <th className="text-right px-3 py-2">Reach</th>
                  <th className="text-right px-3 py-2">Engagement</th>
                  <th className="text-left px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{r.week_start}</td>
                    <td className="px-3 py-2">{r.platform}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.followers?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.posts_count ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.reach?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.engagement_total?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2 text-text-secondary">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function NumInput({ v, set }) {
  return (
    <input
      className="input py-1 text-xs w-28 font-mono text-right"
      inputMode="numeric"
      value={v ?? ''}
      onChange={(e) => set(e.target.value)}
    />
  );
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function HealthAlerts({ health }) {
  const platforms = Object.entries(health || {});
  if (platforms.length === 0) return null;
  // Unknown = we have no data to judge yet. Not an alert — just a quiet hint.
  const unknown = platforms.filter(([, h]) => h.status === 'unknown');
  const real = platforms.filter(([, h]) => h.status !== 'healthy' && h.status !== 'unknown');

  if (real.length === 0 && unknown.length === platforms.length) {
    // First-time state: nothing has data. Don't show any alarm.
    return (
      <div className="card-pad border-border text-sm">
        <div className="text-text-primary font-medium">No metrics tracked yet.</div>
        <div className="text-text-secondary text-xs mt-1">
          Enter a week below for any platform to start the trendline. Platform health alerts will appear once we have something to compare against.
        </div>
      </div>
    );
  }

  if (real.length === 0) {
    return (
      <div className="card-pad border-success/30 bg-success/5 text-sm">
        <div className="text-success font-medium">All tracked platforms healthy.</div>
        <div className="text-text-secondary text-xs mt-1">
          Recent posting cadence on every tracked platform, no engagement dropoff beyond tolerance.
          {unknown.length > 0 && ` ${unknown.length} platform${unknown.length === 1 ? '' : 's'} not tracked yet.`}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {real.map(([platform, h]) => {
        const tone = h.status === 'neglected' ? 'danger' : 'warning';
        const bgCls = tone === 'danger' ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5';
        const textCls = tone === 'danger' ? 'text-danger' : 'text-warning';
        const reason = h.days_since_last_posted === null
          ? 'No posts logged recently on this platform.'
          : `Last posted ${h.days_since_last_posted} day${h.days_since_last_posted === 1 ? '' : 's'} ago.`;
        const trendNote = h.engagement_trend !== null && h.engagement_trend < -0.10
          ? ` Engagement ${Math.abs(h.engagement_trend * 100).toFixed(0)}% below prior week.`
          : '';
        return (
          <div key={platform} className={`card-pad ${bgCls}`}>
            <div className={`text-sm font-medium ${textCls}`}>
              {platform} · {h.status}
            </div>
            <div className="text-xs text-text-secondary mt-1">{reason}{trendNote}</div>
          </div>
        );
      })}
    </div>
  );
}
