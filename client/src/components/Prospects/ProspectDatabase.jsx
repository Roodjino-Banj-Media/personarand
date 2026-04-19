import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import ProspectDetail from './ProspectDetail.jsx';

export default function ProspectDatabase() {
  const [rows, setRows] = useState([]);
  const [facets, setFacets] = useState({ industries: [], sources: [], stages: {} });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ stage: '', status: '', industry: '', source: '', q: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeId, setActiveId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [list, f] = await Promise.all([api.prospects.list(filters), api.prospects.facets()]);
      setRows(list || []);
      setFacets(f || { industries: [], sources: [], stages: {} });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [filters.stage, filters.status, filters.industry, filters.source]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [filters.q]);

  return (
    <div className="space-y-4">
      <div className="card-pad flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="label">Search</div>
          <input className="input" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Name, company, email" />
        </div>
        <div>
          <div className="label">Stage</div>
          <select className="input" value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
            <option value="">All</option>
            {Object.keys(facets.stages).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Industry</div>
          <select className="input" value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })}>
            <option value="">All</option>
            {facets.industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Source</div>
          <select className="input" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="">All</option>
            {facets.sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <button className="btn" onClick={() => setShowImport(true)}>Import CSV</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add prospect</button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">No prospects yet. Add one or import a CSV to start.</div>
      ) : (
        <div className="card overflow-x-auto -mx-4 md:mx-0 rounded-none md:rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-text-secondary">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3">Name / Company</th>
                <th className="text-left px-3 py-3">Stage</th>
                <th className="text-left px-3 py-3">Email</th>
                <th className="text-right px-3 py-3">Emails</th>
                <th className="text-right px-3 py-3">Replies</th>
                <th className="text-right px-3 py-3">Meetings</th>
                <th className="text-right px-3 py-3">Deal</th>
                <th className="text-left px-3 py-3">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-[#141414] cursor-pointer" onClick={() => setActiveId(r.id)}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-text-secondary">{r.company || ''} {r.title ? `· ${r.title}` : ''}</div>
                  </td>
                  <td className="px-3 py-2"><span className={`pill ${stagePill(r.stage)}`}>{r.stage?.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{r.email || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_emails || 0}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_replies || 0}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_meetings || 0}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.deal_value ? `$${Number(r.deal_value).toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-2 text-text-secondary text-xs">{r.last_email_at?.slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddProspectModal onClose={() => setShowAdd(false)} onSaved={async () => { setShowAdd(false); await load(); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={async () => { setShowImport(false); await load(); }} />}
      {activeId && <ProspectDetail id={activeId} onClose={() => { setActiveId(null); load(); }} />}
    </div>
  );
}

function stagePill(stage) {
  const map = {
    prospecting: 'border-border text-text-secondary',
    contacted: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
    responded: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    meeting_booked: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
    meeting_done: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
    proposal: 'border-warning/40 text-warning bg-warning/5',
    negotiation: 'border-warning/40 text-warning bg-warning/5',
    client: 'border-success/40 text-success bg-success/5',
    dead: 'border-border text-text-secondary opacity-50',
  };
  return map[stage] || map.prospecting;
}

function AddProspectModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', company: '', title: '', email: '', linkedin_url: '', industry: '', source: 'manual', pain_points: '', linkedin_context: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.prospects.create({
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Add prospect" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Company"><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="LinkedIn URL"><input className="input" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
        <Field label="Industry"><input className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
        <Field label="Source"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
        <Field label="Tags"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma-separated" /></Field>
        <div className="col-span-2">
          <div className="label">Pain points</div>
          <textarea className="input min-h-[70px]" value={form.pain_points} onChange={(e) => setForm({ ...form, pain_points: e.target.value })} />
        </div>
        <div className="col-span-2">
          <div className="label">LinkedIn context (paste their bio / recent posts for AI to personalize)</div>
          <textarea className="input min-h-[100px] font-mono text-xs" value={form.linkedin_context} onChange={(e) => setForm({ ...form, linkedin_context: e.target.value })} placeholder="Paste bio, recent LinkedIn posts, company news — the AI uses this when personalizing outreach" />
        </div>
      </div>
      {error && <div className="text-danger text-xs mt-2">{error}</div>}
      <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-6 px-6 -mb-6 pb-6">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving || !form.name}>{saving ? 'Adding…' : 'Add'}</button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const row = {};
      header.forEach((h, i) => row[h] = cols[i]);
      return row;
    });
    setPreview({ header, rows, total: rows.length });
  }
  async function runImport() {
    setBusy(true);
    try { setResult(await api.prospects.import(preview.rows)); } catch (err) { alert(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal title="Import prospects from CSV" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-text-secondary text-xs">Header columns: <code>name</code> (required), <code>company</code>, <code>title</code>, <code>email</code>, <code>linkedin_url</code>, <code>industry</code>, <code>source</code>, <code>tags</code>.</div>
        <input type="file" accept=".csv" onChange={(e) => handleFile(e.target.files[0])} className="text-xs" />
        {preview && (
          <div className="card-pad text-xs">
            <div className="font-medium">{preview.total} rows</div>
            <div className="text-text-secondary mt-1">Columns: {preview.header.join(', ')}</div>
          </div>
        )}
        {result && <div className="card-pad border-success/40 bg-success/5 text-xs">Inserted {result.inserted}, skipped {result.skipped} (duplicates or missing name), invalid {result.invalid}.</div>}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-6 px-6 -mb-6 pb-6">
        {result ? <button className="btn-primary" onClick={onDone}>Done</button> : <button className="btn-primary" onClick={runImport} disabled={!preview || busy}>{busy ? 'Importing…' : `Import ${preview?.total || 0}`}</button>}
      </div>
    </Modal>
  );
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { cols.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) { return <div><div className="label">{label}</div>{children}</div>; }
