import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function TemplatesView() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setTemplates(await api.emailTemplates.list()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createBlank() {
    const t = await api.emailTemplates.create({
      name: 'New template',
      category: 'custom',
      subject_line: 'Subject {variable}',
      body: 'Body with {variables}.',
      best_for: 'cold',
    });
    await load();
    setEditing(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-text-secondary">10 canonical templates seeded. Edit, duplicate, or create new ones. Response rate tracked per template.</div>
        <button className="btn-primary" onClick={createBlank}>+ New template</button>
      </div>
      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="card-pad hover:border-[#555] transition-colors cursor-pointer" onClick={() => setEditing(t)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{t.name}</div>
                    <span className="pill border-border text-text-secondary text-[10px]">{t.best_for}</span>
                  </div>
                  <div className="text-[11px] text-text-secondary mt-1">{t.subject_line}</div>
                  <div className="text-[10px] text-text-secondary mt-2 font-mono">
                    Used {t.times_used}× · Replied {t.times_replied}×{t.response_rate != null ? ` · ${t.response_rate}% response rate` : ''}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <TemplateEditor template={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function TemplateEditor({ template, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: template.name,
    category: template.category,
    subject_line: template.subject_line,
    body: template.body,
    best_for: template.best_for || 'cold',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.emailTemplates.update(template.id, form);
      onSaved();
    } catch (err) { alert(err.message); setSaving(false); }
  }

  async function remove() {
    if (!confirm('Delete this template?')) return;
    await api.emailTemplates.remove(template.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Template</div>
            <div className="text-lg font-semibold mt-1">{template.name}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <div className="label">Name</div>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <div className="label">Best for</div>
              <select className="input" value={form.best_for} onChange={(e) => setForm({ ...form, best_for: e.target.value })}>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
              </select>
            </div>
          </div>
          <div>
            <div className="label">Subject line · use {`{variables}`}</div>
            <input className="input" value={form.subject_line} onChange={(e) => setForm({ ...form, subject_line: e.target.value })} />
          </div>
          <div>
            <div className="label">Body</div>
            <textarea className="input font-mono text-sm min-h-[320px] whitespace-pre-wrap" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="text-[11px] text-text-secondary">
            Performance: used {template.times_used}×, replied {template.times_replied}× — {template.response_rate != null ? `${template.response_rate}% reply rate` : 'not enough data'}
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-border">
            <button className="btn-ghost text-danger text-xs" onClick={remove}>Delete</button>
            <div className="flex gap-2">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
