import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function ProspectDetail({ id, onClose }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setData(await api.prospects.get(id)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function quickAction(fn) {
    await fn();
    await load();
  }

  if (loading || !data) {
    return <Modal onClose={onClose}><div className="text-text-secondary">Loading…</div></Modal>;
  }

  return (
    <Modal onClose={onClose} title={`${data.name} @ ${data.company || '—'}`}>
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="pill border-border text-text-secondary capitalize">{data.stage?.replace(/_/g, ' ')}</span>
        {data.email && <span className="font-mono text-text-secondary">{data.email}</span>}
        {data.deal_value && <span className="font-mono">${Number(data.deal_value).toLocaleString()}</span>}
      </div>

      <div className="flex gap-1 border-b border-border mb-4">
        {['overview', 'history', 'actions'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px capitalize ${
              tab === t ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >{t}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} onChange={load} />}
      {tab === 'history' && <History data={data} />}
      {tab === 'actions' && <Actions data={data} onChange={load} onClose={onClose} />}
    </Modal>
  );
}

function Overview({ data, onChange }) {
  const [painPoints, setPainPoints] = useState(data.pain_points || '');
  const [notes, setNotes] = useState(data.notes || '');
  const [linkedinContext, setLinkedinContext] = useState(data.linkedin_context || '');
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    try {
      await api.prospects.update(data.id, { pain_points: painPoints, notes, linkedin_context: linkedinContext });
      onChange();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Info label="Title" value={data.title} />
        <Info label="Industry" value={data.industry} />
        <Info label="Phone" value={data.phone} />
        <Info label="LinkedIn" value={data.linkedin_url ? <a className="text-primary" href={data.linkedin_url} target="_blank" rel="noopener noreferrer">View ↗</a> : null} />
        <Info label="Website" value={data.website} />
        <Info label="Source" value={data.source} />
      </div>
      <div>
        <div className="label">Pain points</div>
        <textarea className="input min-h-[70px]" value={painPoints} onChange={(e) => setPainPoints(e.target.value)} />
      </div>
      <div>
        <div className="label">LinkedIn context (pasted bio / posts — AI uses this)</div>
        <textarea className="input min-h-[120px] font-mono text-xs" value={linkedinContext} onChange={(e) => setLinkedinContext(e.target.value)} placeholder="Paste their LinkedIn bio, recent posts, company news..." />
      </div>
      <div>
        <div className="label">Notes</div>
        <textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {data.subscriber && (
        <div className="card-pad border-primary/40 bg-primary/5 text-xs">
          Linked to newsletter subscriber ({data.subscriber.email}) — opened {data.subscriber.total_opens || 0}, clicked {data.subscriber.total_clicks || 0}.
        </div>
      )}
    </div>
  );
}

function History({ data }) {
  const items = [
    ...(data.emails || []).map((e) => ({ kind: 'email', at: e.sent_at, title: e.subject, sub: e.replied_at ? `replied ${e.replied_at.slice(0, 10)}` : e.clicked_at ? 'clicked' : e.opened_at ? 'opened' : 'sent' })),
    ...(data.meetings || []).map((m) => ({ kind: 'meeting', at: m.scheduled_date, title: `${m.meeting_type || 'Meeting'}`, sub: m.status === 'completed' ? `outcome: ${m.outcome || 'unspecified'}` : m.status })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  if (items.length === 0) return <div className="text-text-secondary text-sm">No history yet.</div>;

  return (
    <div className="space-y-2 text-sm">
      {items.map((it, i) => (
        <div key={i} className="border-b border-border pb-2 last:border-0">
          <div className="flex items-baseline justify-between">
            <div>
              <span className={`pill ${it.kind === 'email' ? 'border-blue-500/40 text-blue-300 bg-blue-500/10' : 'border-purple-500/40 text-purple-300 bg-purple-500/10'} mr-2`}>{it.kind}</span>
              <span className="font-medium">{it.title}</span>
            </div>
            <span className="text-[11px] text-text-secondary font-mono">{(it.at || '').slice(0, 10)}</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

function Actions({ data, onChange, onClose }) {
  const [msg, setMsg] = useState(null);
  async function linkToNewsletter() {
    try {
      const r = await api.attribution.prospectToNewsletter(data.id);
      setMsg(`Linked to subscriber ${r.subscriber_id}.`);
      onChange();
    } catch (err) { setMsg(`Failed: ${err.message}`); }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={linkToNewsletter}>Add to newsletter</button>
        <a className="btn text-center" href={data.linkedin_url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => !data.linkedin_url && e.preventDefault()}>
          Open LinkedIn ↗
        </a>
      </div>
      <StageChanger prospect={data} onChange={onChange} />
      <DealValueEditor prospect={data} onChange={onChange} />
      {msg && <div className="text-xs text-text-secondary">{msg}</div>}
      <div className="pt-2 border-t border-border">
        <button className="btn-ghost text-xs text-danger" onClick={async () => {
          if (confirm('Archive this prospect?')) {
            await api.prospects.remove(data.id);
            onClose();
          }
        }}>Delete prospect</button>
      </div>
    </div>
  );
}

function StageChanger({ prospect, onChange }) {
  const STAGES = ['prospecting', 'contacted', 'responded', 'meeting_booked', 'meeting_done', 'proposal', 'negotiation', 'client', 'dead'];
  return (
    <div>
      <div className="label">Move to stage</div>
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s}
            className={`pill ${prospect.stage === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}
            onClick={async () => { await api.prospects.move(prospect.id, s); onChange(); }}
          >{s.replace(/_/g, ' ')}</button>
        ))}
      </div>
    </div>
  );
}

function DealValueEditor({ prospect, onChange }) {
  const [value, setValue] = useState(prospect.deal_value || '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.prospects.update(prospect.id, { deal_value: value ? Number(value) : null });
      onChange();
    } finally { setSaving(false); }
  }
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <div className="label">Deal value ($)</div>
        <input className="input font-mono" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{value || <span className="text-text-secondary">—</span>}</div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div className="text-lg font-semibold">{title || 'Prospect'}</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
