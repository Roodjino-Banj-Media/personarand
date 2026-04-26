import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import GenerateModal from '../Calendar/GenerateModal.jsx';

const CATEGORY_LABELS = {
  note: 'Note',
  project: 'Project',
  client: 'Client',
  framework: 'Framework',
  positioning: 'Positioning',
  voice: 'Voice',
  haiti: 'Haiti context',
  other: 'Other',
};

// Starter pack — shown ONLY when the KB is empty. Clicking one opens the
// editor pre-filled with a skeleton so the user spends 5 minutes filling it
// in instead of staring at a blank page. Every entry here is high-signal
// for the AI's next generation.
const STARTER_TEMPLATES = [
  {
    title: 'Active clients & projects',
    category: 'client',
    content_md: `# Active clients & projects

Anonymized if needed. The AI uses this to make examples specific.

## Client / project 1
- **Who**: (e.g., Haitian fintech founder, Series A)
- **Stage / situation**: (what are they actually doing right now?)
- **What they care about**: (their top 1-2 pain points)
- **What I'm helping with**: (concretely)

## Client / project 2
...

## What these clients have in common
(the pattern — feeds sharper generations)
`,
  },
  {
    title: 'Q2 positioning — what I want the market to hear right now',
    category: 'positioning',
    content_md: `# Q2 positioning

## The one sentence
(If someone describes me in a deal room, what should they say?)

## Three things I am
1.
2.
3.

## Three things I am NOT
1.
2.
3.

## The shift from last quarter
(What's different about how I'm showing up now?)
`,
  },
  {
    title: 'Frameworks I\'m pushing this quarter',
    category: 'framework',
    content_md: `# Live frameworks

These are the frameworks I want referenced in new content. Architect Tax and Distribution Debt are already in the brand prompt — what's NEW?

## Framework 1 — (name)
- **One-line**:
- **Why it matters now**:
- **Example I can point to**:

## Framework 2 — (name)
...
`,
  },
  {
    title: 'Haiti context — what\'s happening this month',
    category: 'haiti',
    content_md: `# Haiti context — current

Feeds the AI local specificity. Update when context changes.

## The big 2-3 stories
1.
2.
3.

## What the Haitian operator class is thinking about
(the mood, the fears, the opportunities)

## What's different from 3 months ago
`,
  },
  {
    title: 'Who I\'m actually speaking to',
    category: 'project',
    content_md: `# Primary audiences

## Audience 1 — (e.g., "Haitian founders doing 7-8 figures")
- **Job title / role**:
- **Their biggest bet right now**:
- **What they read / who they follow**:
- **What they want from me**:

## Audience 2 — (e.g., "Diaspora capital allocators")
...

## Secondary audience — (e.g., "Global media / journalists")
...
`,
  },
  {
    title: 'What the AI should NEVER say',
    category: 'voice',
    content_md: `# Anti-voice — off-limits

Violations of brand voice. If the AI produces any of these, reject and regenerate.

## Phrases / registers I don't use
- Generic LinkedIn platitudes ("At the end of the day…", "It's all about…")
- Empty entrepreneurial cheerleading
- (add your own)

## Framings I don't take
- "I grew X followers by Y" (vanity metrics as lead)
- "Here's what I learned" without specifics
- Haiti-as-victim framing
- (add your own)

## Topics to leave to someone else
-
`,
  },
];

export default function KnowledgeView() {
  const [entries, setEntries] = useState([]);
  const [totalActiveTokens, setTotalActiveTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | entry object
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  // generateFrom: KB entry the user wants to spin into a post. Opens
  // GenerateModal with the entry's title + content as the seed topic so
  // the AI generates from the captured thought without retyping.
  const [generateFrom, setGenerateFrom] = useState(null);
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.knowledge.list();
      setEntries(r.entries || []);
      setTotalActiveTokens(r.total_active_tokens || 0);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggle(id, is_active) {
    try {
      await api.knowledge.update(id, { is_active });
      load();
    } catch (err) { alert(err.message); }
  }

  async function remove(id, title) {
    if (!confirm(`Delete "${title}"? This removes it permanently.`)) return;
    try {
      await api.knowledge.remove(id);
      load();
    } catch (err) { alert(err.message); }
  }

  const q = query.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (filter !== 'all' && e.category !== filter) return false;
    if (!q) return true;
    return (e.title || '').toLowerCase().includes(q) || (e.content_md || '').toLowerCase().includes(q);
  });
  const activeCount = entries.filter((e) => e.is_active).length;
  const categoriesInUse = [...new Set(entries.map((e) => e.category))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <p className="text-text-secondary text-sm mt-1">
            Paste or upload markdown. Everything <strong>active</strong> here gets injected into every AI call (Briefing,
            Plan with AI, Generate content, Newsletter expand). This is what turns generic output into specific output.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn"
            onClick={async () => {
              try { await api.knowledge.export(); }
              catch (err) { alert(`Export failed: ${err.message}`); }
            }}
            title="Download all knowledge entries as a single markdown file"
          >
            ⬇ Export
          </button>
          <button className="btn-ghost" onClick={() => setImporting(true)} title="Bulk-create entries from a markdown document with ## section headings">
            ⬆ Import markdown
          </button>
          <button className="btn-primary" onClick={() => setEditing('new')}>+ New entry</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Active entries" value={activeCount} />
        <Stat label="Total entries" value={entries.length} />
        <Stat label="Active tokens" value={totalActiveTokens.toLocaleString()} />
        <Stat
          label="Categories"
          value={categoriesInUse.length}
          hint={categoriesInUse.length > 0 ? categoriesInUse.map((c) => CATEGORY_LABELS[c] || c).join(', ') : '—'}
        />
      </div>

      {totalActiveTokens > 20000 && (
        <div className="card-pad border-warning/40 bg-warning/5 text-sm">
          <strong className="text-warning">Heads up:</strong> your active KB is <strong>{totalActiveTokens.toLocaleString()}</strong> tokens.
          Each AI call includes all of this in the system prompt. That means higher cost per call. Consider marking less-critical entries inactive.
        </div>
      )}

      <div>
        <input
          className="input"
          type="search"
          placeholder="Search titles or content…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={`pill ${filter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`} onClick={() => setFilter('all')}>
          All ({entries.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const count = entries.filter((e) => e.category === key).length;
          if (count === 0) return null;
          return (
            <button
              key={key}
              className={`pill ${filter === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}
              onClick={() => setFilter(key)}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="space-y-4">
          <div className="card-pad border-primary/40 bg-primary/5">
            <div className="text-primary font-semibold">Start here — pick a template to fill in</div>
            <div className="text-text-secondary text-sm mt-1">
              The AI references everything you mark <strong>active</strong> as context for every generation.
              With 0 entries, output stays generic. Even 2-3 filled entries materially sharpens the voice.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => setEditing({ ...t, _starter: true })}
                className="card-pad text-left hover:border-primary/60 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{t.title}</div>
                  <span className="pill border-border text-text-secondary text-[10px]">{CATEGORY_LABELS[t.category]}</span>
                </div>
                <div className="text-[11px] text-text-secondary mt-2 line-clamp-3 whitespace-pre-wrap">
                  {t.content_md.split('\n').slice(2, 8).join(' ').slice(0, 160)}…
                </div>
              </button>
            ))}
          </div>
          <div className="text-[11px] text-text-secondary text-center">
            Or{' '}
            <button className="underline hover:text-primary" onClick={() => setEditing('new')}>start with a blank entry</button>.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">No entries match this filter.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className={`card-pad ${e.is_active ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(e)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`pill ${e.is_active ? 'border-success/40 bg-success/5 text-success' : 'border-border text-text-secondary'}`}>
                      {e.is_active ? 'active' : 'inactive'}
                    </span>
                    <span className="pill border-border text-text-secondary text-[10px]">{CATEGORY_LABELS[e.category] || e.category}</span>
                    <span className="text-[11px] text-text-secondary">~{e.token_estimate || 0} tokens</span>
                  </div>
                  <div className="text-base font-semibold mt-2 truncate">{e.title}</div>
                  <div className="text-sm text-text-secondary mt-1 line-clamp-2 whitespace-pre-wrap">
                    {(e.content_md || '').slice(0, 200)}{e.content_md?.length > 200 ? '…' : ''}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    className="btn-ghost text-xs !text-primary hover:bg-primary/10"
                    onClick={() => setGenerateFrom(e)}
                    title="Open the generator with this entry as the topic seed — closes the loop from captured thought to produced post"
                  >
                    ✨ Generate
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => toggle(e.id, !e.is_active)}>
                    {e.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setEditing(e)}>Edit</button>
                  <button className="btn-ghost text-xs text-danger" onClick={() => remove(e.id, e.title)}>×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EntryEditor
          entry={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {importing && (
        <ImportMarkdownModal
          onClose={() => setImporting(false)}
          onImported={() => { setImporting(false); load(); }}
        />
      )}

      {generateFrom && (
        <GenerateModal
          seed={{
            // Use the entry's title as the headline topic; full content
            // goes into `extra` so the AI has the captured detail without
            // letting it dominate the topic line. funnel_layer is left
            // blank so GenerateModal's default doesn't get over-anchored.
            topic: generateFrom.title,
            extra: `Source — captured Knowledge Base entry "${generateFrom.title}":\n\n${generateFrom.content_md}\n\nUse the captured material as the substantive base; turn it into the requested format.`,
          }}
          onClose={() => setGenerateFrom(null)}
        />
      )}
    </div>
  );
}

/**
 * Bulk markdown importer. Splits on level-2 headings (## Title); each
 * section becomes one KB entry. Optional metadata bullets immediately
 * under a heading override defaults:
 *
 *   ## Working with [client]
 *   - Category: client
 *   - Active: yes
 *
 *   …content here…
 *
 * Preview is computed client-side so the user sees how their markdown
 * will be parsed BEFORE committing — we never want a surprise import
 * that creates 17 wrong entries.
 */
function ImportMarkdownModal({ onClose, onImported }) {
  const [markdown, setMarkdown] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [defaultActive, setDefaultActive] = useState(true);

  const sections = parseSectionsClientSide(markdown);

  async function commit() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.knowledge.importMarkdown(markdown, { default_active: defaultActive });
      onImported?.(r);
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div className="card-pad bg-card border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Bulk import</div>
            <div className="text-lg font-semibold mt-1">Import knowledge from markdown</div>
            <div className="text-[11px] text-text-secondary mt-1 leading-relaxed max-w-2xl">
              Paste a markdown document. Each <code>## Heading</code> becomes one KB entry. Add optional metadata bullets under a heading: <code>- Category: framework</code> or <code>- Active: yes/no</code>. Capped at 50 sections per import.
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>✕</button>
        </div>

        <textarea
          className="input min-h-[260px] font-mono text-xs"
          placeholder={`## Distribution Debt\n- Category: framework\n\nThe unrealized commercial value of work you have done but not made legible to your market.\n\n## Working with Banj Media\n- Category: project\n\nWe are building...`}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          disabled={busy}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={defaultActive}
              onChange={(e) => setDefaultActive(e.target.checked)}
              disabled={busy}
            />
            Activate imported entries by default
          </label>
        </div>

        {sections.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-text-secondary">
              Preview · {sections.length} {sections.length === 1 ? 'entry' : 'entries'} will be created:
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {sections.map((s, i) => (
                <div key={i} className="text-[11px] flex items-center gap-2 rounded border border-border bg-[#0f0f0f] p-2">
                  <span className="font-mono text-text-secondary">{i + 1}.</span>
                  <span className="font-semibold text-text-primary truncate">{s.title}</span>
                  {s.category && <span className="pill border-border text-text-secondary text-[10px]">{s.category}</span>}
                  {s.is_active === false && <span className="text-warning text-[10px]">inactive</span>}
                  <span className="text-text-secondary text-[10px] ml-auto">{s.contentChars} chars</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {markdown && sections.length === 0 && (
          <div className="text-xs text-warning">No <code>## Heading</code> sections found. Each entry needs a level-2 markdown heading.</div>
        )}

        {error && <div className="text-xs text-danger">{error}</div>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost text-xs" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn-primary text-xs"
            onClick={commit}
            disabled={busy || sections.length === 0}
          >
            {busy ? 'Importing…' : `Import ${sections.length} ${sections.length === 1 ? 'entry' : 'entries'} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mirror of the server-side parser for client-side preview. Kept simple
 *  on purpose — the server is the source of truth on import; this is
 *  just so the user sees what will happen before clicking Import. */
function parseSectionsClientSide(markdown) {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let cur = null;
  function push() {
    if (!cur) return;
    const content = cur._raw.join('\n').trim();
    out.push({ title: cur.title, category: cur.category, is_active: cur.is_active, contentChars: content.length });
    cur = null;
  }
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) { push(); cur = { title: m[1].trim(), _raw: [], category: null, is_active: null }; continue; }
    if (!cur) continue;
    const meta = line.match(/^\s*-\s*(category|active)\s*:\s*(.+?)\s*$/i);
    if (meta && cur._raw.length === 0) {
      const k = meta[1].toLowerCase();
      const v = meta[2].toLowerCase().trim();
      if (k === 'category') cur.category = v;
      if (k === 'active') cur.is_active = ['yes', 'true', '1'].includes(v);
      continue;
    }
    cur._raw.push(line);
  }
  push();
  return out;
}

function Stat({ label, value, hint }) {
  return (
    <div className="card-pad">
      <div className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-2xl font-semibold mt-1 font-mono">{value}</div>
      {hint && <div className="text-[10px] text-text-secondary mt-1 truncate" title={hint}>{hint}</div>}
    </div>
  );
}

function EntryEditor({ entry, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: entry?.title || '',
    category: entry?.category || 'note',
    content_md: entry?.content_md || '',
    is_active: entry?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  async function save() {
    if (!form.title.trim() || !form.content_md.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (entry?.id) {
        await api.knowledge.update(entry.id, form);
      } else {
        await api.knowledge.create(form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    const text = await file.text();
    setForm((f) => ({
      ...f,
      content_md: f.content_md ? `${f.content_md}\n\n${text}` : text,
      title: f.title || file.name.replace(/\.(md|txt|markdown)$/i, ''),
    }));
  }

  const tokens = Math.ceil((form.content_md || '').length / 4);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Knowledge entry</div>
            <div className="text-lg font-semibold mt-1">{entry?.id ? 'Edit' : 'New'}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
            <div>
              <div className="label">Title</div>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Banj Media Q2 positioning" />
            </div>
            <div>
              <div className="label">Category</div>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div className="label">Markdown content</div>
              <div className="flex gap-2 items-center">
                <button className="btn-ghost text-xs" onClick={() => fileRef.current?.click()}>Upload .md file</button>
                <span className="text-[11px] text-text-secondary">~{tokens.toLocaleString()} tokens</span>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            <textarea
              className="input font-mono text-sm min-h-[320px] whitespace-pre-wrap"
              value={form.content_md}
              onChange={(e) => setForm({ ...form, content_md: e.target.value })}
              placeholder="# What I'm thinking about right now

Paste any markdown. It becomes part of the AI's context for every generation.

## Good examples:
- Client situation: 'We're in Q2 pitching a Haitian fintech founder who...'
- Framework draft: 'The distribution-infrastructure stack has 5 layers...'
- Recent insight: 'I noticed my AI-framework carousels outperform my strategy essays 2x...'"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <span>Active (included in AI system prompt)</span>
          </label>
          {error && <div className="text-danger text-xs">{error}</div>}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
