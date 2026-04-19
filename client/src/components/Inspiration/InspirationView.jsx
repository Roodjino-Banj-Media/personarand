import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

export default function InspirationView() {
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const [list, tagList] = await Promise.all([
        api.uploads.list(activeTag ? { tag: activeTag } : {}),
        api.uploads.tags(),
      ]);
      setItems(list || []);
      setTags(tagList || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeTag]);

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await api.uploads.upload(file, { tags: [], notes: '' });
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this file? This removes it from disk.')) return;
    try {
      await api.uploads.remove(id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visual Inspiration</h1>
        <p className="text-text-secondary text-sm mt-1">
          Reference images, screenshots, competitor carousels, typography exploration. Tag them, pull them up when building.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className={`card cursor-pointer transition-colors p-10 text-center ${
          dragOver ? 'border-primary bg-primary/5' : 'hover:border-[#555]'
        }`}
      >
        <div className="text-lg font-medium">
          {uploading ? 'Uploading…' : 'Drop files here, or click to browse'}
        </div>
        <div className="text-xs text-text-secondary mt-2">
          JPG · PNG · WebP · GIF · PDF — up to 10MB each
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <div className="text-danger text-sm">{error}</div>}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`pill ${activeTag === '' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}
            onClick={() => setActiveTag('')}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              className={`pill ${activeTag === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}
              onClick={() => setActiveTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">
          No files yet. Drop something above to start a visual library.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <InspirationCard
              key={item.id}
              item={item}
              onEdit={() => setEditing(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function InspirationCard({ item, onEdit, onDelete }) {
  const isPdf = item.filepath?.toLowerCase().endsWith('.pdf');
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="aspect-square bg-[#0f0f0f] flex items-center justify-center overflow-hidden">
        {isPdf ? (
          <div className="text-text-secondary text-sm">PDF</div>
        ) : (
          <img
            src={item.filepath}
            alt={item.filename}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        )}
      </div>
      <div className="p-3">
        <div className="text-xs truncate text-text-secondary">{item.filename}</div>
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.map((t) => (
              <span key={t} className="pill border-border text-text-secondary text-[10px]">{t}</span>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button className="btn-ghost text-xs" onClick={onEdit}>Edit</button>
          <button className="btn-ghost text-xs text-danger hover:text-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ item, onClose, onSaved }) {
  const [tagsText, setTagsText] = useState((item.tags || []).join(', '));
  const [notes, setNotes] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      await api.uploads.patch(item.id, { tags, notes });
      onSaved();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="card w-full max-w-lg">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Edit</div>
            <div className="text-sm truncate mt-1">{item.filename}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="label">Tags (comma-separated)</div>
            <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g. carousel, dark, typography" />
          </div>
          <div>
            <div className="label">Notes</div>
            <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this is useful, what you'd borrow from it" />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
