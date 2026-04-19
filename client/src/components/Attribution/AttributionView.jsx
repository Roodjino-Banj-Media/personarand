import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function AttributionView() {
  const [contentRev, setContentRev] = useState([]);
  const [insights, setInsights] = useState([]);
  const [hot, setHot] = useState([]);
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cr, ins, h, sc] = await Promise.all([
        api.attribution.contentRevenue().catch(() => []),
        api.insights.list('active').catch(() => []),
        api.attribution.hotProspects().catch(() => []),
        api.unified.scorecard().catch(() => null),
      ]);
      setContentRev(cr);
      setInsights(ins);
      setHot(h);
      setScorecard(sc);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function generateInsights() {
    setGenerating(true);
    try {
      await api.insights.generate();
      await load();
    } catch (err) { alert(err.message); } finally { setGenerating(false); }
  }

  async function dismiss(id) {
    await api.insights.dismiss(id);
    await load();
  }

  async function linkSubscriber(subId) {
    try {
      await api.attribution.newsletterToProspect(subId);
      await load();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attribution &amp; Intelligence</h1>
          <p className="text-text-secondary text-sm mt-1">
            Content → newsletter → prospect → revenue. The chain made visible.
          </p>
        </div>
        <button className="btn-primary" onClick={generateInsights} disabled={generating}>
          {generating ? 'Analyzing…' : '🔄 Generate insights'}
        </button>
      </div>

      {insights.length > 0 && (
        <section>
          <div className="section-title">Active insights ({insights.length})</div>
          <div className="space-y-2">
            {insights.map((i) => (
              <div key={i.id} className={`card-pad ${priorityCls(i.priority)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{i.title}</div>
                    <div className="text-sm text-text-secondary mt-1">{i.description}</div>
                    {i.action_recommended && <div className="text-xs text-primary mt-2">→ {i.action_recommended}</div>}
                  </div>
                  <button className="btn-ghost text-xs" onClick={() => dismiss(i.id)}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hot.length > 0 && (
        <section>
          <div className="section-title">Hot newsletter prospects (engaged subscribers)</div>
          <div className="space-y-2">
            {hot.map((h) => (
              <div key={h.id} className="card-pad flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{h.email}</div>
                  <div className="text-[11px] text-text-secondary">
                    {h.name || 'unknown'} · {h.total_opens} opens · {h.total_clicks} clicks
                    {h.prospect_id && <span> · <span className="text-success">linked to prospect</span></span>}
                  </div>
                </div>
                {!h.prospect_id && (
                  <button className="btn-ghost text-xs" onClick={() => linkSubscriber(h.id)}>Convert to prospect</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">Top revenue-driving content</div>
        {loading ? <div className="text-text-secondary">Loading…</div> :
         contentRev.length === 0 ? (
          <div className="card-pad text-text-secondary text-sm">
            No attribution chains yet. Close a deal + mark a meeting as &quot;closed_won&quot; to start building this view.
          </div>
        ) : (
          <div className="space-y-2">
            {contentRev.map((c) => (
              <div key={c.id} className="card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-[11px] text-text-secondary mt-1">
                      {c.content_type} · {c.platform || 'multi'} · {c.prospects_influenced} prospects · {c.meetings} meetings
                    </div>
                  </div>
                  <div className="text-lg font-semibold font-mono text-success">${Number(c.attributed_revenue).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {scorecard && (
        <section>
          <div className="section-title">This week at a glance</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Content posted" value={scorecard.content_posted} />
            <Stat label="Emails sent" value={scorecard.emails_sent} />
            <Stat label="Meetings done" value={scorecard.meetings_completed} />
            <Stat label="Deals closed" value={scorecard.deals_closed} tone={scorecard.deals_closed > 0 ? 'success' : null} />
            <Stat label="New subscribers" value={scorecard.new_subscribers} />
            <Stat label="Proposals sent" value={scorecard.proposals_sent} />
            <Stat label="Deal value closed" value={scorecard.deals_value ? `$${Number(scorecard.deals_value).toLocaleString()}` : '—'} tone="success" />
            <Stat label="Pipeline value" value={scorecard.pipeline_value ? `$${Number(scorecard.pipeline_value).toLocaleString()}` : '—'} />
          </div>
        </section>
      )}
    </div>
  );
}

function priorityCls(p) {
  if (p === 'high') return 'border-danger/40 bg-danger/5';
  if (p === 'medium') return 'border-warning/40 bg-warning/5';
  return 'border-border bg-[#0f0f0f]';
}

function Stat({ label, value, tone }) {
  const color = tone === 'success' ? 'text-success' : 'text-text-primary';
  return (
    <div className="card-pad">
      <div className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className={`text-2xl font-semibold mt-1 font-mono ${color}`}>{value ?? '—'}</div>
    </div>
  );
}
