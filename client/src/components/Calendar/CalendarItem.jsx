import { useEffect, useRef, useState } from 'react';

const STATUS_STYLE = {
  planned: 'border-border text-text-secondary bg-[#1f1f1f]',
  scripted: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  shot: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
  edited: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  posted: 'border-success/40 text-success bg-success/5',
};

// Card-level tint reflects progress at a glance. planned=neutral,
// scripted=subtle blue halo (has drafts), posted=green halo.
const CARD_TINT = {
  planned: '',
  scripted: 'border-blue-500/30 bg-blue-500/[0.04]',
  shot: 'border-purple-500/30 bg-purple-500/[0.04]',
  edited: 'border-amber-500/30 bg-amber-500/[0.04]',
  posted: 'border-success/40 bg-success/[0.05]',
};

export default function CalendarItem({ item, onClick, onStatusChange, onTitleSave }) {
  const statusCls = STATUS_STYLE[item.status] || STATUS_STYLE.planned;
  const cardTint = CARD_TINT[item.status] || '';
  const hasDrafts = Number(item.content_count || 0) > 0;
  const hasPosted = Number(item.posted_count || 0) > 0;

  // Inline title editing. Title text is always rendered through this state so
  // we can optimistically show the user's edits before the server round-trip.
  // Click on the title → focuses the textarea (stopPropagation prevents the
  // card's drawer-open click from firing). Blur or Enter → save.
  const [titleDraft, setTitleDraft] = useState(item.title || '');
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState(null);
  const taRef = useRef(null);

  // Re-sync when the item changes underneath (e.g., parent reload).
  useEffect(() => { setTitleDraft(item.title || ''); }, [item.title, item.id]);

  function autoSize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
  useEffect(() => { autoSize(); }, [titleDraft]);

  async function commitTitle() {
    const next = titleDraft.trim();
    if (!next || next === (item.title || '')) {
      // Nothing to save; revert any whitespace-only entry.
      setTitleDraft(item.title || '');
      return;
    }
    if (!onTitleSave) return;
    setSavingTitle(true);
    setTitleError(null);
    try {
      await onTitleSave(next);
    } catch (err) {
      setTitleError(err.message || 'Save failed');
      // Revert to server value on failure so the user sees what's actually persisted.
      setTitleDraft(item.title || '');
    } finally {
      setSavingTitle(false);
    }
  }

  function handleTitleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur(); // triggers commitTitle via onBlur
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitleDraft(item.title || '');
      e.currentTarget.blur();
    }
  }

  return (
    <div
      className={`card-pad cursor-pointer hover:border-[#555] transition-colors ${cardTint}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-widest text-text-secondary">{item.day}</div>
        <span className={`pill ${statusCls}`}>{item.status}</span>
      </div>

      {/* Inline-editable title. Click into it, edit, Enter or blur to save.
          stopPropagation prevents the card-level drawer-open click from firing. */}
      <textarea
        ref={taRef}
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={commitTitle}
        onKeyDown={handleTitleKeyDown}
        rows={1}
        className="w-full bg-transparent text-base font-semibold mt-2 leading-snug outline-none resize-none border-b border-transparent hover:border-border/60 focus:border-primary transition-colors px-0 py-0.5"
        style={{ overflow: 'hidden' }}
        title="Click to edit. Press Enter to save, Esc to cancel."
      />
      {savingTitle && <div className="text-[10px] text-text-secondary mt-1">Saving…</div>}
      {titleError && <div className="text-[10px] text-danger mt-1">{titleError}</div>}

      {item.funnel_layer && (
        <div className="text-[11px] text-text-secondary mt-2">
          {item.funnel_layer}
        </div>
      )}
      {item.platforms && item.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {item.platforms.map((p) => (
            <span key={p} className="pill border-border text-text-secondary">{p}</span>
          ))}
        </div>
      )}
      {hasDrafts && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span
            className={hasPosted ? 'text-success' : 'text-blue-300'}
            title={`${item.content_count} generated draft${item.content_count === 1 ? '' : 's'}${hasPosted ? ` — ${item.posted_count} posted` : ''}`}
          >
            📝 {item.content_count} draft{item.content_count === 1 ? '' : 's'}
            {hasPosted && <> · {item.posted_count} posted</>}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center mt-4">
        <div className="text-[11px] text-text-secondary truncate pr-2">{item.content_type}</div>
        <select
          className="text-[11px] bg-[#0f0f0f] border border-border rounded px-2 py-1 text-text-secondary"
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {Object.keys(STATUS_STYLE).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
