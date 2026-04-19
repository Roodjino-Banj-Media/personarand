import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

export default function NewsletterSubscribers() {
  const [rows, setRows] = useState([]);
  const [facets, setFacets] = useState({ sources: [], tags: [], status_counts: [] });
  const [filters, setFilters] = useState({ status: 'active', tag: '', source: '', min_engagement: '', q: '' });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [list, f] = await Promise.all([
        api.subscribers.list(filters),
        api.subscribers.facets(),
      ]);
      setRows(list || []);
      setFacets(f || { sources: [], tags: [], status_counts: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters.status, filters.tag, filters.source, filters.min_engagement]);
  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [filters.q]);

  async function handleDelete(id) {
    if (!confirm('Remove this subscriber? They will no longer receive newsletters.')) return;
    try {
      await api.subscribers.remove(id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-pad flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="label">Search</div>
          <input className="input" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Email, name, company" />
        </div>
        <div>
          <div className="label">Status</div>
          <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>
        </div>
        <div>
          <div className="label">Source</div>
          <select className="input" value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
            <option value="">All</option>
            {facets.sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Tag</div>
          <select className="input" value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}>
            <option value="">All</option>
            {facets.tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Min engagement</div>
          <input className="input w-20 text-right font-mono" inputMode="numeric" value={filters.min_engagement} onChange={(e) => setFilters((f) => ({ ...f, min_engagement: e.target.value }))} />
        </div>
        <div className="flex gap-2 ml-auto">
          <button className="btn" onClick={() => setShowImport(true)}>Import CSV</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">
          No subscribers match. Add one, import a CSV, or check your filters.
        </div>
      ) : (
        <div className="card overflow-x-auto -mx-4 md:mx-0 rounded-none md:rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-text-secondary">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-3 py-3">Name / company</th>
                <th className="text-left px-3 py-3">Source</th>
                <th className="text-left px-3 py-3">Tags</th>
                <th className="text-right px-3 py-3">Score</th>
                <th className="text-right px-3 py-3">Opens</th>
                <th className="text-right px-3 py-3">Clicks</th>
                <th className="text-right px-3 py-3">Subscribed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-[#141414]">
                  <td className="px-4 py-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusDot(r.status)}`} title={r.status} />
                      {r.email}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.name || <span className="text-text-secondary">—</span>}</div>
                    <div className="text-[11px] text-text-secondary">{r.company || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{r.source || '—'}</td>
                  <td className="px-3 py-2">
                    {(r.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="pill border-border text-text-secondary text-[10px] mr-1">{t}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className={scoreColor(r.computed_engagement)}>{r.computed_engagement ?? 0}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_opens || 0}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_clicks || 0}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.subscribed_at?.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-ghost text-xs" onClick={() => setEditing(r)}>Edit</button>
                    <button className="btn-ghost text-xs text-danger" onClick={() => handleDelete(r.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={async () => { setShowAdd(false); await load(); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={async () => { setShowImport(false); await load(); }} />}
      {editing && <EditModal subscriber={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function scoreColor(score) {
  if (score == null) return 'text-text-secondary';
  if (score >= 70) return 'text-success font-semibold';
  if (score >= 40) return 'text-warning';
  if (score >= 20) return 'text-text-primary';
  return 'text-text-secondary';
}

function statusDot(status) {
  if (status === 'active') return 'bg-success';
  if (status === 'unsubscribed') return 'bg-text-secondary';
  if (status === 'bounced') return 'bg-danger';
  return 'bg-text-secondary';
}

function AddModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', name: '', company: '', title: '', source: 'manual', tags: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.subscribers.create({
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
    <Modal title="Add subscriber" onClose={onClose}>
      <FormGrid>
        <Field label="Email *"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Company"><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Source"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
        <Field label="Tags (comma-separated)"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. AI, media, prospect" /></Field>
      </FormGrid>
      {error && <div className="text-danger text-xs">{error}</div>}
      <ModalFooter onClose={onClose}>
        <button className="btn-primary" onClick={save} disabled={saving || !form.email}>{saving ? 'Adding…' : 'Add'}</button>
      </ModalFooter>
    </Modal>
  );
}

function EditModal({ subscriber, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: subscriber.name || '',
    company: subscriber.company || '',
    title: subscriber.title || '',
    source: subscriber.source || '',
    tags: (subscriber.tags || []).join(', '),
    status: subscriber.status,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.subscribers.update(subscriber.id, {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      onSaved();
    } catch (err) {
      alert(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${subscriber.email}`} onClose={onClose}>
      <FormGrid>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Company"><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Source"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
        <Field label="Tags"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>
        </Field>
      </FormGrid>
      <ModalFooter onClose={onClose}>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </ModalFooter>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return;
    const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const row = {};
      header.forEach((h, i) => { row[h] = cols[i]; });
      return row;
    });
    setPreview({ header, rows, total: rows.length });
  }

  async function runImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await api.subscribers.import(preview.rows);
      setResult(r);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import subscribers from CSV" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="text-text-secondary text-xs">
          CSV must have a header row. Supported columns: <code>email</code> (required), <code>name</code>, <code>company</code>, <code>title</code>, <code>source</code>, <code>tags</code> (comma-separated within the field).
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files[0])} className="text-xs" />
        {preview && (
          <div className="card-pad text-xs">
            <div className="font-medium">Preview: {preview.total} rows, columns: {preview.header.join(', ')}</div>
            <div className="text-text-secondary mt-1">First row: <code>{JSON.stringify(preview.rows[0])}</code></div>
          </div>
        )}
        {result && (
          <div className="card-pad border-success/40 bg-success/5 text-xs">
            Inserted {result.inserted}, skipped {result.skipped_duplicate} duplicates, {result.invalid} invalid rows.
          </div>
        )}
      </div>
      <ModalFooter onClose={onClose}>
        {result ? (
          <button className="btn-primary" onClick={onDone}>Done</button>
        ) : (
          <button className="btn-primary" onClick={runImport} disabled={!preview || busy}>
            {busy ? 'Importing…' : `Import ${preview?.total || 0} rows`}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-2xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onClose, children }) {
  return (
    <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-6 px-6 -mb-6 pb-6">
      <button className="btn" onClick={onClose}>Cancel</button>
      {children}
    </div>
  );
}

function FormGrid({ children }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function Field({ label, children }) { return <div><div className="label">{label}</div>{children}</div>; }
