import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const VISIBLE_STAGES = ['prospecting', 'contacted', 'responded', 'meeting_booked', 'meeting_done', 'proposal', 'negotiation', 'client'];

const STAGE_LABELS = {
  prospecting: 'Prospecting',
  contacted: 'Contacted',
  responded: 'Responded',
  meeting_booked: 'Meeting booked',
  meeting_done: 'Meeting done',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  client: 'Client',
};

export default function PipelineBoard() {
  const [board, setBoard] = useState(null);
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [b, o, a] = await Promise.all([
        api.pipeline.board(),
        api.pipeline.overview(),
        api.pipeline.analytics(),
      ]);
      setBoard(b);
      setOverview(o);
      setAnalytics(a);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function moveCard(prospectId, stage) {
    try {
      await api.prospects.move(prospectId, stage);
      await load();
    } catch (err) { alert(err.message); }
  }

  if (loading || !board) return <div className="text-text-secondary">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pipeline value" value={overview ? `$${Number(overview.pipeline_value).toLocaleString()}` : '—'} />
        <Stat label="Closed value" value={overview ? `$${Number(overview.closed_value).toLocaleString()}` : '—'} tone="success" />
        <Stat label="Meeting→Proposal" value={analytics?.meeting_to_proposal != null ? `${analytics.meeting_to_proposal}%` : '—'} />
        <Stat label="Proposal→Client" value={analytics?.proposal_to_client != null ? `${analytics.proposal_to_client}%` : '—'} />
      </div>

      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="flex gap-3 min-w-[1200px] px-4 md:px-0">
          {VISIBLE_STAGES.map((stage) => {
            const cards = board[stage] || [];
            const stageValue = overview?.stages?.[stage]?.total_value || 0;
            return (
              <div
                key={stage}
                className="flex-1 min-w-[180px] max-w-[220px]"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragged) moveCard(dragged, stage); setDragged(null); }}
              >
                <div className="card-pad !p-3 mb-2 sticky top-0 bg-card z-10">
                  <div className="text-[11px] uppercase tracking-wider text-text-secondary">{STAGE_LABELS[stage]}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="font-mono text-sm">{cards.length}</div>
                    {stageValue > 0 && <div className="text-[10px] font-mono text-text-secondary">${Number(stageValue).toLocaleString()}</div>}
                  </div>
                </div>
                <div className="space-y-2">
                  {cards.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragged(c.id)}
                      onDragEnd={() => setDragged(null)}
                      className="card-pad !p-3 cursor-grab active:cursor-grabbing hover:border-[#555] transition-colors"
                    >
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      {c.company && <div className="text-[11px] text-text-secondary truncate">{c.company}</div>}
                      <div className="flex justify-between mt-2 text-[10px] text-text-secondary font-mono">
                        <span>{Math.round(c.days_in_stage || 0)}d</span>
                        {c.deal_value && <span>${Number(c.deal_value).toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[11px] text-text-secondary">Drag cards between columns to change stage.</div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const color = tone === 'success' ? 'text-success' : 'text-text-primary';
  return (
    <div className="card-pad">
      <div className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className={`text-2xl font-semibold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
