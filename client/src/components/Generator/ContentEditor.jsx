import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const STATUS_OPTIONS = ['draft', 'scheduled', 'posted', 'archived'];

const PLATFORM_HINT = {
  X: '280 chars per tweet',
  'Instagram Reels': 'Caption up to 2,200 chars; first 125 show before "more"',
  Instagram: 'Caption up to 2,200 chars',
  LinkedIn: 'Up to 3,000 chars; no cut-off before ~210',
  TikTok: 'Caption up to 2,200 chars',
  YouTube: 'Description up to 5,000 chars',
};

export default function ContentEditor({ initial, platform, type, onRegenerate, regenerating }) {
  const [body, setBody] = useState(initial.body || '');
  const [title, setTitle] = useState(initial.title || '');
  const [status, setStatus] = useState(initial.status || 'draft');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [id, setId] = useState(initial.id);

  useEffect(() => {
    setBody(initial.body || '');
    setTitle(initial.title || '');
    setStatus(initial.status || 'draft');
    setId(initial.id);
    setSavedAt(null);
  }, [initial.id]);

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const chars = body.length;

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.library.update(id, { body, title, status });
      setSavedAt(new Date());
      setBody(updated.body);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Copy failed — select and copy manually');
    }
  }

  return (
    <div className="card flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <input
          className="bg-transparent outline-none text-sm font-medium flex-1 min-w-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
        />
        <div className="flex items-center gap-2">
          <select
            className="input py-1 text-xs w-32"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <textarea
        className="flex-1 bg-[#0f0f0f] p-4 text-sm text-text-primary font-mono leading-relaxed outline-none min-h-[300px] resize-y"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck
      />

      <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[11px] text-text-secondary">
        <div className="flex gap-4">
          <span>{words} words</span>
          <span>{chars} chars</span>
          {PLATFORM_HINT[platform] && <span>· {PLATFORM_HINT[platform]}</span>}
          {savedAt && <span className="text-success">Saved {savedAt.toLocaleTimeString()}</span>}
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={onRegenerate} disabled={regenerating || saving}>
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
          <button className="btn" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
