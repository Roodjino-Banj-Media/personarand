import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../lib/api.js';

export default function NewsletterForms() {
  const [forms, setForms] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setForms(await api.signupForms.list()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createBlank() {
    const form = await api.signupForms.create({
      name: 'New form',
      headline: 'Get weekly frameworks on media strategy and AI',
      cta: 'Subscribe',
    });
    await load();
    setEditing(form);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this form? Existing signups from it stay in the subscriber list.')) return;
    await api.signupForms.remove(id);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-text-secondary">
          Create signup forms → embed on your site, share the hosted page, or drop the QR at events.
        </div>
        <button className="btn-primary" onClick={createBlank}>+ New form</button>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : forms.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">No forms yet. Create one to start capturing subscribers.</div>
      ) : (
        <div className="space-y-2">
          {forms.map((f) => (
            <div key={f.id} className="card-pad hover:border-[#555] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(f)}>
                  <div className="text-base font-semibold">{f.name}</div>
                  <div className="text-sm text-text-secondary mt-0.5 truncate">{f.headline}</div>
                  <div className="text-[11px] text-text-secondary mt-2 font-mono">
                    ID: {f.id} · {f.signups_count || 0} signups · /s/{f.id}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn-ghost text-xs" onClick={() => setEditing(f)}>Edit</button>
                  <button className="btn-ghost text-xs text-danger" onClick={() => handleDelete(f.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <FormEditor form={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function FormEditor({ form, onClose, onSaved }) {
  const [f, setF] = useState({
    name: form.name || '',
    headline: form.headline || '',
    subheadline: form.subheadline || '',
    cta: form.cta || 'Subscribe',
    placeholder: form.placeholder || 'you@work.com',
    success_message: form.success_message || 'Welcome. Check your inbox for email #1.',
    default_tags: (form.default_tags || []).join(', '),
    style: form.style || 'dark',
  });
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);

  const hostedUrl = `${window.location.origin}/s/${form.id}`;
  const embedCode = `<iframe src="${hostedUrl}" width="100%" height="520" frameborder="0" style="border:0; border-radius:8px;"></iframe>`;

  useEffect(() => {
    // Render QR code to canvas using a minimal inline generator
    renderQr(hostedUrl, canvasRef.current);
  }, [form.id, hostedUrl]);

  async function save() {
    setSaving(true);
    try {
      await api.signupForms.update(form.id, {
        ...f,
        default_tags: f.default_tags ? f.default_tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      onSaved();
    } catch (err) {
      alert(err.message);
      setSaving(false);
    }
  }

  async function copyEmbed() {
    try { await navigator.clipboard.writeText(embedCode); alert('Embed code copied.'); } catch { alert('Copy failed — select manually.'); }
  }
  async function copyUrl() {
    try { await navigator.clipboard.writeText(hostedUrl); alert('URL copied.'); } catch { alert('Copy failed.'); }
  }

  function downloadQr() {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `signup-qr-${form.id}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Signup form</div>
            <div className="text-lg font-semibold mt-1">{form.name}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-3">
            <Field label="Name (internal)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Headline"><input className="input" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></Field>
            <Field label="Subheadline"><input className="input" value={f.subheadline} onChange={(e) => setF({ ...f, subheadline: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA button"><input className="input" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} /></Field>
              <Field label="Email placeholder"><input className="input" value={f.placeholder} onChange={(e) => setF({ ...f, placeholder: e.target.value })} /></Field>
            </div>
            <Field label="Success message"><input className="input" value={f.success_message} onChange={(e) => setF({ ...f, success_message: e.target.value })} /></Field>
            <Field label="Default tags (comma-separated)"><input className="input" value={f.default_tags} onChange={(e) => setF({ ...f, default_tags: e.target.value })} placeholder="e.g. website, linkedin-bio" /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>

          <aside className="space-y-3">
            <div>
              <div className="label">Hosted page URL</div>
              <input className="input text-xs font-mono" readOnly value={hostedUrl} onFocus={(e) => e.target.select()} />
              <div className="flex gap-2 mt-1.5">
                <button className="btn-ghost text-xs" onClick={copyUrl}>Copy</button>
                <a className="btn-ghost text-xs" href={hostedUrl} target="_blank" rel="noopener noreferrer">Open ↗</a>
              </div>
            </div>
            <div>
              <div className="label">Embed code</div>
              <textarea className="input text-[10px] font-mono min-h-[70px]" readOnly value={embedCode} onFocus={(e) => e.target.select()} />
              <button className="btn-ghost text-xs mt-1.5" onClick={copyEmbed}>Copy embed</button>
            </div>
            <div>
              <div className="label">QR code</div>
              <div className="flex flex-col items-center gap-2 p-3 bg-white rounded">
                <canvas ref={canvasRef} width="180" height="180" />
              </div>
              <button className="btn-ghost text-xs mt-1.5" onClick={downloadQr}>Download PNG</button>
            </div>
            <div className="text-[11px] text-text-secondary">
              Total signups: <span className="font-mono">{form.signups_count || 0}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) { return <div><div className="label">{label}</div>{children}</div>; }

function renderQr(text, canvas) {
  if (!canvas) return;
  QRCode.toCanvas(canvas, text, { width: 180, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
    .catch((err) => console.error('[qr]', err));
}
