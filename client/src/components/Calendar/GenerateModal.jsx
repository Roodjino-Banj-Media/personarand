import { useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { copyToClipboard } from '../../lib/clipboard.js';
import ContentEditor from '../Generator/ContentEditor.jsx';

const TYPE_OPTIONS = [
  { value: 'linkedin-short', label: 'LinkedIn post (short)' },
  { value: 'linkedin-long', label: 'LinkedIn post (long)' },
  { value: 'x-thread', label: 'X thread' },
  { value: 'x-standalone', label: 'X standalone' },
  { value: 'instagram-caption', label: 'Instagram caption' },
  { value: 'video-hook-beats', label: 'Video script — hook + beats' },
  { value: 'video-word-for-word', label: 'Video script — word for word' },
  { value: 'youtube-essay', label: 'YouTube essay' },
  { value: 'article', label: 'Article / long-form' },
  { value: 'carousel', label: 'Carousel' },
];

const PLATFORMS = ['LinkedIn', 'X', 'Instagram', 'Instagram Reels', 'TikTok', 'YouTube'];
const TONES = ['sharp', 'balanced', 'warm'];
const LENGTHS = ['short', 'medium', 'long'];

function inferType(item) {
  const ct = (item.content_type || '').toLowerCase();
  if (ct.includes('thread')) return 'x-thread';
  if (ct.includes('carousel')) return 'carousel';
  if (ct.includes('youtube') || ct.includes('essay')) return 'youtube-essay';
  if (ct.includes('word-for-word')) return 'video-word-for-word';
  if (ct.includes('video') || ct.includes('clip') || ct.includes('short-form')) return 'video-hook-beats';
  if (ct.includes('article')) return 'article';
  if (ct.includes('long post')) return 'linkedin-long';
  if (ct.includes('linkedin')) return 'linkedin-short';
  if (ct.includes('caption') || ct.includes('instagram')) return 'instagram-caption';
  return 'linkedin-short';
}

// item = calendar entry (from Calendar). seed = free-form seed (from Library "Generate similar").
// Exactly one should be provided.
export default function GenerateModal({ item, seed, onClose }) {
  const source = item || seed || {};
  const initialType = useMemo(() => seed?.type || inferType(item || {}), [item, seed]);
  const initialPlatform = seed?.platform || (item?.platforms || [])[0] || 'LinkedIn';

  const [type, setType] = useState(initialType);
  const [platform, setPlatform] = useState(initialPlatform);
  const [tone, setTone] = useState('balanced');
  const [length, setLength] = useState('medium');
  const [extra, setExtra] = useState(seed?.extra || '');
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState(null);
  const [promptPreview, setPromptPreview] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const headerLabel = item
    ? `Generate \u00b7 Week ${item.week} \u00b7 ${item.day}`
    : 'Generate similar';
  const headerTitle = item?.title || seed?.topic || 'New generation';

  async function handleGenerate(regenExtra) {
    setGenerating(true);
    setError(null);
    try {
      const topic = item
        ? `${item.title}\n\nBrief: ${item.description}`
        : seed?.topic || '';
      const payload = {
        calendar_id: item?.id || null,
        type,
        platform,
        tone,
        length,
        funnel_layer: item?.funnel_layer || seed?.funnel_layer,
        topic,
        extra: regenExtra || extra || undefined,
        save: true,
      };
      const row = await api.generate.content(payload);
      setResult(row);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    await handleGenerate('Try a different angle from the previous one. Vary the hook, the structure, or the framing.');
  }

  async function handleCopyPrompt() {
    setCopying(true);
    setCopyMsg(null);
    try {
      const topic = item
        ? `${item.title}\n\nBrief: ${item.description}`
        : seed?.topic || '';
      const { combined } = await api.prompts.build({
        type,
        platform,
        topic,
        tone,
        length,
        funnel_layer: item?.funnel_layer || seed?.funnel_layer,
        extra: extra || undefined,
      });
      const ok = await copyToClipboard(combined);
      setCopyMsg(ok
        ? 'Copied. Paste into claude.ai for unlimited refinement.'
        : 'Copy blocked by browser. Use the preview below to select manually.');
      if (!ok) setPromptPreview(combined);
      setTimeout(() => setCopyMsg(null), 6000);
    } catch (err) {
      setCopyMsg(`Copy failed: ${err.message}`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-5xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">
              {headerLabel}
            </div>
            <h2 className="text-lg font-semibold mt-1">{headerTitle}</h2>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <Field label="Format">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)} disabled={generating}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Platform">
              <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)} disabled={generating}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label={`Tone · ${tone}`}>
              <div className="flex rounded-md border border-border overflow-hidden">
                {TONES.map((t) => (
                  <button
                    key={t}
                    disabled={generating}
                    onClick={() => setTone(t)}
                    className={`flex-1 px-2 py-2 text-xs transition-colors ${
                      tone === t ? 'bg-primary text-white' : 'bg-[#0f0f0f] text-text-secondary hover:bg-[#1f1f1f]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Length">
              <div className="flex rounded-md border border-border overflow-hidden">
                {LENGTHS.map((l) => (
                  <button
                    key={l}
                    disabled={generating}
                    onClick={() => setLength(l)}
                    className={`flex-1 px-2 py-2 text-xs transition-colors ${
                      length === l ? 'bg-primary text-white' : 'bg-[#0f0f0f] text-text-secondary hover:bg-[#1f1f1f]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Extra direction (optional)">
              <textarea
                className="input min-h-[80px]"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="e.g. lead with the Banj Media R&D angle"
                disabled={generating}
              />
            </Field>
            <div className="space-y-2">
              <button
                className="btn w-full justify-center"
                onClick={handleCopyPrompt}
                disabled={copying || generating}
                title="Build the full prompt and copy to clipboard — paste into claude.ai for unlimited refinement"
              >
                {copying ? 'Copying…' : 'Copy prompt for claude.ai'}
              </button>
              <button
                className="btn-primary w-full justify-center"
                onClick={() => handleGenerate()}
                disabled={generating}
              >
                {generating ? 'Generating…' : result ? 'Regenerate' : 'Generate in app (Opus 4.7)'}
              </button>
            </div>
            {copyMsg && (
              <div className="text-success text-xs leading-relaxed">
                {copyMsg}
              </div>
            )}
            {promptPreview && (
              <div className="space-y-2">
                <div className="text-[11px] text-text-secondary">Select all below and copy manually:</div>
                <textarea
                  readOnly
                  value={promptPreview}
                  className="input text-[11px] font-mono min-h-[120px] max-h-[200px]"
                  onFocus={(e) => e.target.select()}
                />
                <button className="btn-ghost text-xs" onClick={() => setPromptPreview(null)}>
                  Dismiss preview
                </button>
              </div>
            )}
            {error && (
              <div className="text-danger text-xs leading-relaxed">
                {error}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {!result && !generating && (
              <div className="card-pad text-text-secondary text-sm h-full flex items-center justify-center min-h-[300px]">
                Fill in the options on the left, then generate. Output will appear here.
              </div>
            )}
            {generating && !result && (
              <div className="card-pad text-text-secondary text-sm h-full flex items-center justify-center min-h-[300px]">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  Calling Claude Opus 4.7…
                </div>
              </div>
            )}
            {result && (
              <ContentEditor
                initial={result}
                platform={platform}
                type={type}
                onRegenerate={handleRegenerate}
                regenerating={generating}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}
