import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import VoiceCapture from '../common/VoiceCapture.jsx';

/**
 * Quick Capture modal — dictate or type, classify, route.
 *
 * Three-stage flow:
 *
 *   1. Capture
 *      Big textarea with VoiceCapture autostart. User talks/types.
 *      "Capture" submits to /api/quick-capture/classify.
 *
 *   2. Classified
 *      Shows the AI's classification + rationale. Renders the four
 *      destination options. The recommended one is highlighted; the
 *      others are still one-click-away because the user might disagree.
 *
 *   3. Confirmed
 *      Shows a short "Saved → [destination]" with a Done button.
 *
 * Routing is by direct write to existing endpoints (no new write paths).
 * The Calendar slot uses week=99 as a sentinel "unscheduled bucket"
 * matching the calendar.js INSERT default. The user can then drag/edit
 * the slot's week from Calendar view.
 */

const CATEGORY_META = {
  knowledge: {
    label: 'Knowledge Base',
    icon: '🧠',
    description: 'Stable fact / framework / project — injected into every AI generation as context.',
    primaryAction: 'kb',
  },
  'post-idea': {
    label: 'Planned post',
    icon: '📅',
    description: 'New calendar slot, status = planned. Ready to generate when you are.',
    primaryAction: 'post',
  },
  reactive: {
    label: 'Reactive seed',
    icon: '⚡',
    description: 'Calendar slot marked reactive — fast-track to ReactToNow when you open it.',
    primaryAction: 'reactive',
  },
  journal: {
    label: 'Journal note',
    icon: '📓',
    description: 'Saved to KB with category=note, marked inactive — accessible to you, not in the AI\'s active context.',
    primaryAction: 'journal',
  },
};

export default function QuickCaptureModal({ onClose }) {
  const navigate = useNavigate();
  const [stage, setStage] = useState('capture'); // 'capture' | 'classified' | 'confirmed'
  const [text, setText] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedTo, setSavedTo] = useState(null);

  // Close on Escape — keyboard convention for modals.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !saving && !classifying) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, classifying]);

  async function handleClassify() {
    if (text.trim().length < 10) {
      setError('Capture at least 10 characters before classifying.');
      return;
    }
    setError(null);
    setClassifying(true);
    try {
      const r = await api.quickCapture.classify(text);
      setClassification(r);
      setStage('classified');
    } catch (e) {
      setError(e.message || 'Classification failed');
    } finally {
      setClassifying(false);
    }
  }

  async function handleRoute(action) {
    if (!classification) return;
    setError(null);
    setSaving(true);
    try {
      if (action === 'kb') {
        await api.knowledge.create({
          title: classification.title,
          category: classification.kb_category || 'note',
          content_md: text,
          is_active: true,
        });
        setSavedTo({ label: 'Knowledge Base', view: '/knowledge' });
      } else if (action === 'journal') {
        // Same write path as KB but inactive — keeps it out of the AI's context.
        await api.knowledge.create({
          title: classification.title,
          category: 'note',
          content_md: text,
          is_active: false,
        });
        setSavedTo({ label: 'Journal (inactive KB)', view: '/knowledge' });
      } else if (action === 'post' || action === 'reactive') {
        const isReactive = action === 'reactive';
        await api.calendar.create({
          week: 99, // "unscheduled" bucket — matches calendar.js default
          title: classification.title,
          description: text,
          content_type: classification.platform === 'X' ? 'twitter-thread' : 'linkedin-short',
          platforms: classification.platform ? [classification.platform] : ['LinkedIn'],
          funnel_layer: classification.funnel_layer || 'Discovery',
          status: 'planned',
          is_reactive: isReactive,
          reactive_source: isReactive ? text : null,
        });
        setSavedTo({
          label: isReactive ? 'Reactive seed (Calendar)' : 'Planned post (Calendar)',
          view: '/calendar',
        });
      }
      setStage('confirmed');
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setText('');
    setClassification(null);
    setSavedTo(null);
    setError(null);
    setStage('capture');
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-t-xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-primary">⚡ Quick capture</div>
            <div className="text-lg font-semibold mt-1">
              {stage === 'capture' && 'Capture a thought'}
              {stage === 'classified' && 'Where should it go?'}
              {stage === 'confirmed' && 'Saved'}
            </div>
          </div>
          <button className="btn-ghost text-sm" onClick={onClose} disabled={saving || classifying}>✕</button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-md border border-danger/40 bg-danger/5 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Stage 1: capture */}
        {stage === 'capture' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-text-secondary">Speak or type — the AI will decide where it belongs.</div>
              <VoiceCapture value={text} onChange={setText} />
            </div>
            <textarea
              className="input min-h-[160px] text-sm"
              placeholder="A thought, a fact, an observation, a reaction. Don't worry about formatting."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-[11px] text-text-secondary font-mono">
                {text.length.toLocaleString()} characters
                {text.trim().length < 10 && text.length > 0 && ' — needs 10+'}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs" onClick={onClose} disabled={classifying}>Cancel</button>
                <button
                  className="btn-primary text-xs"
                  onClick={handleClassify}
                  disabled={classifying || text.trim().length < 10}
                >
                  {classifying ? 'Classifying…' : 'Classify and route →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: classified */}
        {stage === 'classified' && classification && (
          <div className="p-5 space-y-4">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="text-[11px] uppercase tracking-widest text-primary">AI suggests</div>
              <div className="font-semibold mt-1">
                {CATEGORY_META[classification.category]?.icon} {CATEGORY_META[classification.category]?.label}
              </div>
              <div className="text-xs text-text-secondary mt-1 leading-relaxed">
                {classification.rationale}
              </div>
              {classification.title && (
                <div className="text-[11px] text-text-secondary mt-2">
                  Title: <span className="text-text-primary">{classification.title}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(CATEGORY_META).map(([key, meta]) => {
                const isRecommended = classification.category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleRoute(meta.primaryAction)}
                    disabled={saving}
                    className={`rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${
                      isRecommended
                        ? 'border-primary/60 bg-primary/10 hover:bg-primary/15'
                        : 'border-border bg-[#161616] hover:border-text-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden>{meta.icon}</span>
                      <span className="text-sm font-semibold">{meta.label}</span>
                      {isRecommended && (
                        <span className="text-[10px] uppercase tracking-wider text-primary ml-auto">Recommended</span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">
                      {meta.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t border-border">
              <button className="btn-ghost text-xs" onClick={() => setStage('capture')} disabled={saving}>
                ← Edit text
              </button>
              <button className="btn-ghost text-xs" onClick={onClose} disabled={saving}>Cancel</button>
            </div>
          </div>
        )}

        {/* Stage 3: confirmed */}
        {stage === 'confirmed' && savedTo && (
          <div className="p-5 space-y-4">
            <div className="rounded-md border border-success/40 bg-success/5 p-4 text-center">
              <div className="text-2xl">✓</div>
              <div className="font-semibold text-success mt-1">Saved to {savedTo.label}</div>
              {classification?.title && (
                <div className="text-xs text-text-secondary mt-1">"{classification.title}"</div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                className="btn-ghost text-xs"
                onClick={() => { onClose(); navigate(savedTo.view); }}
              >
                Open {savedTo.label} →
              </button>
              <button className="btn-ghost text-xs" onClick={reset}>
                Capture another
              </button>
              <button className="btn-primary text-xs" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
