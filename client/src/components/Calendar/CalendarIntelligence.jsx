import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function CalendarIntelligence({ initialTab = 'plan', onClose, onItemsAdded }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-5xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Calendar intelligence</div>
            <div className="text-lg font-semibold mt-1">Plan · Brainstorm · Analyze gaps</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="flex gap-1 border-b border-border px-6">
          {[
            { k: 'plan', label: 'Plan a month' },
            { k: 'brainstorm', label: 'Brainstorm angles' },
            { k: 'gaps', label: 'Gaps analysis' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.k ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >{t.label}</button>
          ))}
        </div>
        <div className="p-6">
          {tab === 'plan' && <PlanMonthTab onItemsAdded={onItemsAdded} onClose={onClose} />}
          {tab === 'brainstorm' && <BrainstormTab onItemsAdded={onItemsAdded} />}
          {tab === 'gaps' && <GapsTab onItemsAdded={onItemsAdded} switchToBrainstorm={() => setTab('brainstorm')} />}
        </div>
      </div>
    </div>
  );
}

function PlanMonthTab({ onItemsAdded, onClose }) {
  const [form, setForm] = useState({
    theme: '',
    context: '',
    days: 28,
    start_week: 1,
    funnel_targets: { Discovery: 6, Authority: 4, Trust: 3, Conversion: 2, Identity: 2 },
    platforms: ['LinkedIn', 'X', 'Instagram', 'Instagram Reels', 'TikTok', 'YouTube'],
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, message }
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  async function run() {
    if (form.theme.length < 10) { setError('Theme must be at least 10 chars'); return; }
    setBusy(true); setError(null); setItems([]); setSaved(null); setProgress(null);

    // Chunk >7 days into weekly calls to stay under Vercel's 60s function limit.
    const chunks = [];
    const totalDays = form.days;
    let remaining = totalDays;
    let chunkWeek = form.start_week;
    while (remaining > 0) {
      const chunkDays = Math.min(7, remaining);
      chunks.push({ days: chunkDays, start_week: chunkWeek });
      remaining -= chunkDays;
      chunkWeek += 1;
    }

    try {
      const allItems = [];
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        setProgress({ current: i + 1, total: chunks.length, message: `Planning week ${c.start_week}…` });
        const contextWithHistory = i > 0
          ? `${form.context}\n\nPrior week items (for continuity — don't repeat, build on them):\n${allItems.slice(-10).map((it) => `- ${it.title}`).join('\n')}`
          : form.context;
        const r = await api.calendar.planMonth({
          ...form,
          days: c.days,
          start_week: c.start_week,
          context: contextWithHistory,
          save: false,
        });
        if (r.parse_error) {
          setError(`Week ${c.start_week} parse issue: ${r.parse_error}. Stopping. ${allItems.length} items generated so far.`);
          break;
        }
        allItems.push(...(r.items || []));
      }
      setItems(allItems);
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function acceptAll() {
    if (items.length === 0) return;
    setBusy(true);
    try {
      // Save items directly — already generated via chunked calls above.
      for (const item of items) {
        await api.calendar.create({
          week: item.week,
          day: item.day,
          title: item.title,
          description: item.description,
          content_type: item.content_type,
          platforms: item.platforms || [],
          funnel_layer: item.funnel_layer,
        });
      }
      setSaved(`Saved ${items.length} items into the calendar.`);
      if (onItemsAdded) onItemsAdded();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="label">Theme / brief (required)</div>
        <textarea
          className="input min-h-[80px]"
          value={form.theme}
          onChange={(e) => setForm({ ...form, theme: e.target.value })}
          placeholder="e.g. Build on the Architect Problem thesis for 30 days. Push into the AI-exposes-weak-businesses angle in week 2. Use week 3 to introduce Banj Media's communication-infrastructure positioning."
        />
      </div>
      <div>
        <div className="label">Additional context (optional)</div>
        <textarea
          className="input min-h-[60px]"
          value={form.context}
          onChange={(e) => setForm({ ...form, context: e.target.value })}
          placeholder="e.g. I'm speaking at a conference April 25 — work that in. Also planning to share a client case study that week."
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="label">Days</div>
          <select className="input" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}>
            <option value={7}>7 (1 week)</option>
            <option value={14}>14 (2 weeks)</option>
            <option value={21}>21 (3 weeks)</option>
            <option value={28}>28 (4 weeks)</option>
          </select>
        </div>
        <div>
          <div className="label">Start week number</div>
          <input className="input font-mono" inputMode="numeric" value={form.start_week} onChange={(e) => setForm({ ...form, start_week: Number(e.target.value) || 1 })} />
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div className="text-[11px] text-text-secondary">
          Targets/week: Discovery 6 · Authority 4 · Trust 3 · Conversion 2 · Identity 2
          {form.days > 7 && <div className="mt-1">Plans &gt; 7 days are split into weekly chunks (stays under Vercel's 60s limit).</div>}
        </div>
        <button className="btn-primary" onClick={run} disabled={busy || !form.theme}>
          {busy ? 'Generating…' : items.length > 0 ? 'Regenerate' : 'Generate plan'}
        </button>
      </div>

      {progress && (
        <div className="card-pad border-primary/40 bg-primary/5">
          <div className="flex items-center justify-between text-sm">
            <span>{progress.message}</span>
            <span className="font-mono text-text-secondary">{progress.current} / {progress.total}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[#1f1f1f] overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {error && <div className="text-danger text-xs">{error}</div>}
      {saved && <div className="text-success text-sm">{saved}</div>}

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <div className="section-title !mb-0">{items.length} items generated · Preview</div>
            <button className="btn-primary" onClick={acceptAll} disabled={busy}>
              {busy ? 'Saving…' : 'Add all to calendar'}
            </button>
          </div>
          <PlanPreview items={items} />
          <div className="text-[11px] text-text-secondary pt-2">
            Review the plan. When happy, click &ldquo;Add all to calendar&rdquo; to save. You can then edit or delete individual items as usual.
          </div>
        </div>
      )}
    </div>
  );
}

function PlanPreview({ items }) {
  const byWeek = new Map();
  for (const it of items) {
    const w = it.week || 1;
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w).push(it);
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {[...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, group]) => (
        <div key={week}>
          <div className="text-xs font-medium mb-2">Week {week} · {group.length}</div>
          <div className="space-y-1.5">
            {group.map((it, i) => (
              <div key={i} className="card-pad !p-2 text-xs">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider">{it.day || '—'}</div>
                <div className="font-medium mt-0.5">{it.title}</div>
                <div className="text-[10px] text-text-secondary mt-1">{it.content_type} · {it.funnel_layer}</div>
                {it.platforms && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {it.platforms.map((p) => <span key={p} className="pill border-border text-text-secondary text-[9px] px-1.5">{p}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BrainstormTab({ onItemsAdded }) {
  const [seed, setSeed] = useState('');
  const [count, setCount] = useState(15);
  const [busy, setBusy] = useState(false);
  const [angles, setAngles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  async function run() {
    if (seed.length < 10) { setError('Seed must be at least 10 chars'); return; }
    setBusy(true); setError(null); setAngles([]); setSelected(new Set()); setSaved(null);
    try {
      const r = await api.calendar.brainstorm({ seed, count });
      if (r.parse_error) setError(r.parse_error);
      setAngles(r.angles || []);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function toggle(i) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelected(next);
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const toAdd = [...selected].map((i) => angles[i]);
      for (const a of toAdd) {
        await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            week: 99, // unscheduled week — user sets later
            day: null,
            title: a.title,
            description: `${a.hook}\n\n${a.why_it_works ? 'Why it works: ' + a.why_it_works : ''}`,
            content_type: a.content_type,
            platforms: JSON.stringify(a.platforms || []),
            funnel_layer: a.funnel_layer,
          }),
        });
      }
      setSaved(`Added ${selected.size} angles to calendar (week 99 — move to the week you want via Edit).`);
      setSelected(new Set());
      if (onItemsAdded) onItemsAdded();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="label">Seed idea</div>
        <textarea
          className="input min-h-[80px]"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="e.g. How AI is compressing the gap between a strong business and a weak one."
        />
      </div>
      <div className="flex justify-between items-end">
        <div className="flex gap-2 items-end">
          <div>
            <div className="label">Angles</div>
            <input className="input w-20 font-mono" inputMode="numeric" value={count} onChange={(e) => setCount(Math.max(5, Math.min(25, Number(e.target.value) || 15)))} />
          </div>
        </div>
        <button className="btn-primary" onClick={run} disabled={busy || !seed}>
          {busy ? 'Thinking…' : 'Brainstorm'}
        </button>
      </div>
      {error && <div className="text-danger text-xs">{error}</div>}
      {saved && <div className="text-success text-sm">{saved}</div>}

      {angles.length > 0 && (
        <>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <div className="text-xs text-text-secondary">{selected.size} selected of {angles.length}</div>
            <button className="btn-primary" onClick={addSelected} disabled={saving || selected.size === 0}>
              {saving ? 'Adding…' : `Add ${selected.size} to calendar`}
            </button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {angles.map((a, i) => (
              <label
                key={i}
                className={`block card-pad cursor-pointer transition-colors ${selected.has(i) ? 'border-primary bg-primary/5' : 'hover:border-[#555]'}`}
              >
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                      <span>{a.content_type}</span>
                      <span>·</span>
                      <span>{a.funnel_layer}</span>
                      {(a.platforms || []).slice(0, 2).map((p) => <span key={p} className="pill border-border text-text-secondary text-[9px] px-1.5">{p}</span>)}
                    </div>
                    <div className="text-sm font-semibold mt-1">{a.title}</div>
                    <div className="text-xs text-text-secondary mt-1">{a.hook}</div>
                    {a.why_it_works && <div className="text-[11px] text-primary mt-1">Why: {a.why_it_works}</div>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GapsTab({ onItemsAdded, switchToBrainstorm }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setData(await api.calendar.gaps()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading || !data) return <div className="text-text-secondary">Loading…</div>;

  const weeks = (data.weekly || []).filter((w) => w.week <= 10); // hide scratch week 99

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-secondary">
        Weekly targets: Discovery 6 · Authority 4 · Trust 3 · Conversion 2 · Identity 2 = 17 items/week
      </div>
      {weeks.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">No calendar items to analyze yet.</div>
      ) : (
        <div className="space-y-3">
          {weeks.map((w) => (
            <div key={w.week} className="card-pad">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold">Week {w.week} — {w.total_items} items</div>
                {w.funnel_gaps.length === 0 && w.neglected_platforms.length === 0 && (
                  <span className="pill border-success/40 text-success bg-success/5 text-[10px]">No gaps</span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                {Object.entries(w.funnel_counts).map(([layer, n]) => {
                  const target = data.targets[layer];
                  const pct = Math.min(100, (n / target) * 100);
                  const tone = n >= target ? 'text-success' : n >= target * 0.6 ? 'text-warning' : 'text-danger';
                  return (
                    <div key={layer} className="text-xs">
                      <div className="flex justify-between">
                        <span className="uppercase tracking-wider text-text-secondary">{layer}</span>
                        <span className={`font-mono ${tone}`}>{n}/{target}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-[#1f1f1f] overflow-hidden">
                        <div className={`h-full ${n >= target ? 'bg-success' : n >= target * 0.6 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {w.funnel_gaps.length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="text-text-secondary">Under-covered funnel layers:</div>
                  <div className="mt-1 space-y-0.5">
                    {w.funnel_gaps.map((g) => (
                      <div key={g.layer} className="text-warning">• {g.layer}: {g.planned}/{g.target} — need {g.short_by} more</div>
                    ))}
                  </div>
                </div>
              )}

              {w.neglected_platforms.length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="text-text-secondary">Neglected platforms:</div>
                  <div className="mt-1 text-warning">{w.neglected_platforms.join(', ')}</div>
                </div>
              )}

              {(w.funnel_gaps.length > 0 || w.neglected_platforms.length > 0) && (
                <div className="mt-3">
                  <button className="btn-ghost text-xs" onClick={switchToBrainstorm}>
                    Brainstorm angles to fill →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
