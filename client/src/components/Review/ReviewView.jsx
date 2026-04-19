import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

// Format a Date as YYYY-MM-DD in local time (NOT UTC — toISOString would shift
// by a day in evenings on US timezones).
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function lastMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -13 : -6 - day;
  d.setDate(d.getDate() + diff);
  return fmt(d);
}

function thisMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmt(d);
}

function shiftWeek(week_start, weeks) {
  const [y, m, dd] = week_start.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() + weeks * 7);
  return fmt(d);
}

export default function ReviewView() {
  const [weekStart, setWeekStart] = useState(lastMonday());
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [fields, setFields] = useState({ what_worked: '', what_didnt: '', next_focus: '' });
  const [loading, setLoading] = useState(true);

  async function load(week) {
    setLoading(true);
    try {
      const s = await api.reviews.summary(week);
      setSummary(s);
      setFields({
        what_worked: s.review?.what_worked || '',
        what_didnt: s.review?.what_didnt || '',
        next_focus: s.review?.next_focus || '',
      });
      setSavedAt(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(weekStart); }, [weekStart]);

  async function save() {
    setSaving(true);
    try {
      await api.reviews.save(weekStart, fields);
      setSavedAt(new Date());
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Weekly Review</h1>
          <p className="text-text-secondary text-sm mt-1 max-w-2xl">
            Once a week, look at what actually happened and name it. Pattern recognition is where the feedback loop completes.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn-ghost" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>← Prev</button>
          <div>
            <div className="label">Week starting</div>
            <input
              type="date"
              className="input w-44"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <button
            className="btn-ghost"
            onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
            disabled={weekStart >= thisMonday()}
          >
            Next →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <ReflectionField
              label="What worked"
              hint="Specific. Which post, which angle, which timing — what produced what outcome."
              value={fields.what_worked}
              onChange={(v) => setFields({ ...fields, what_worked: v })}
            />
            <ReflectionField
              label="What didn’t"
              hint="What underperformed, what you didn’t ship, which risks showed up."
              value={fields.what_didnt}
              onChange={(v) => setFields({ ...fields, what_didnt: v })}
            />
            <ReflectionField
              label="Next focus"
              hint="One sentence. What changes next week because of what you learned this week."
              value={fields.next_focus}
              onChange={(v) => setFields({ ...fields, next_focus: v })}
            />
            <div className="flex items-center justify-end gap-3">
              {savedAt && <span className="text-[11px] text-success">Saved {savedAt.toLocaleTimeString()}</span>}
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save review'}
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <WeekContext summary={summary} />
          </aside>
        </div>
      )}
    </div>
  );
}

function ReflectionField({ label, hint, value, onChange }) {
  const words = (value || '').trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="card-pad">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-[11px] text-text-secondary mt-0.5">{hint}</div>
        </div>
        <div className="text-[11px] text-text-secondary">{words} words</div>
      </div>
      <textarea
        className="input mt-3 min-h-[140px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function WeekContext({ summary }) {
  if (!summary) return null;
  const { posted, outcomes, outcome_counts, platform_deltas, posted_by_funnel, prior_week_start } = summary;

  return (
    <>
      <div className="card-pad">
        <div className="section-title !mb-3">This week</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Posts" value={posted.length} />
          <MiniStat label="Outcomes" value={outcomes.length} />
          <MiniStat
            label="Funnel layers"
            value={Object.keys(posted_by_funnel).length}
          />
        </div>
      </div>

      {Object.keys(posted_by_funnel).length > 0 && (
        <div className="card-pad">
          <div className="section-title !mb-2">By funnel layer</div>
          <div className="space-y-1.5">
            {Object.entries(posted_by_funnel).map(([layer, count]) => (
              <div key={layer} className="flex justify-between text-xs">
                <span className="text-text-secondary">{layer}</span>
                <span className="font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-pad">
        <div className="section-title !mb-2">Platform delta vs prior week</div>
        {prior_week_start ? (
          <div className="space-y-1.5">
            {platform_deltas.map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{p.platform}</span>
                <span className={`font-mono ${p.followers_delta > 0 ? 'text-success' : p.followers_delta < 0 ? 'text-danger' : 'text-text-secondary'}`}>
                  {p.followers_delta == null ? '—' : (p.followers_delta > 0 ? '+' : '') + p.followers_delta.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="text-[10px] text-text-secondary pt-1">Prior: week of {prior_week_start}</div>
          </div>
        ) : (
          <div className="text-xs text-text-secondary">No prior week data to compare.</div>
        )}
      </div>

      {posted.length > 0 && (
        <div className="card-pad">
          <div className="section-title !mb-2">Posted this week</div>
          <div className="space-y-2">
            {posted.slice(0, 10).map((p) => (
              <div key={p.id} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{p.title || '(untitled)'}</span>
                  <span className="text-text-secondary shrink-0">{p.platform}</span>
                </div>
                <div className="text-text-secondary text-[10px]">{p.content_type} · {p.funnel_layer || 'no funnel'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outcomes.length > 0 && (
        <div className="card-pad">
          <div className="section-title !mb-2">Outcomes</div>
          <div className="space-y-2 text-xs">
            {Object.entries(outcome_counts).map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span className="text-text-secondary capitalize">{type}</span>
                <span className="font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div className="text-xl font-semibold font-mono">{value}</div>
      <div className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</div>
    </div>
  );
}
