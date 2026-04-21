import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const PLATFORMS = ['LinkedIn', 'Instagram', 'TikTok', 'X', 'YouTube'];

/**
 * Reusable caption generator + editor. Shows for carousels and videos
 * because those have a media/caption split (slides or script vs. the
 * post text that sits above the media).
 *
 * Props:
 *   contentId        — id of the generated_content row
 *   initialCaptionEn — existing EN caption (if any), used to seed the editor
 *   initialCaptionFr — existing FR caption (if any)
 *   hasFrBody        — whether this content has a French body, offers bilingual toggle
 *   onSaved(caption_en, caption_fr) — optional callback after save or generate
 */
export default function CaptionPanel({ contentId, initialCaptionEn, initialCaptionFr, hasFrBody: propHasFrBody, onSaved }) {
  const [captionEn, setCaptionEn] = useState(initialCaptionEn || '');
  const [captionFr, setCaptionFr] = useState(initialCaptionFr || '');
  const [hasFrBody, setHasFrBody] = useState(Boolean(propHasFrBody));
  const [platform, setPlatform] = useState('LinkedIn');
  const [bilingual, setBilingual] = useState(Boolean(propHasFrBody));
  const [lang, setLang] = useState('en');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null); // 'en' | 'fr' | null
  const [savedAt, setSavedAt] = useState(null);

  // If caption data wasn't passed in, fetch the content row so we can
  // seed the editor with any existing caption already saved. Fire-and-forget —
  // if this fails we just start with an empty editor.
  useEffect(() => {
    if (initialCaptionEn !== undefined || initialCaptionFr !== undefined) return;
    if (!contentId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await api.library.get(contentId);
        if (cancelled) return;
        if (row?.caption_en) setCaptionEn(row.caption_en);
        if (row?.caption_fr) setCaptionFr(row.caption_fr);
        if (row?.body_fr && !propHasFrBody) {
          setHasFrBody(true);
          setBilingual(true);
        }
      } catch { /* silent — editor just stays empty */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.library.caption(contentId, { platform, bilingual: bilingual && hasFrBody });
      setCaptionEn(r.caption_en || '');
      if (r.caption_fr) setCaptionFr(r.caption_fr);
      setSavedAt(new Date());
      if (onSaved) onSaved(r.caption_en, r.caption_fr);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.library.update(contentId, {
        caption_en: captionEn || null,
        caption_fr: captionFr || null,
      });
      setSavedAt(new Date());
      if (onSaved) onSaved(captionEn, captionFr);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copy(which) {
    const text = which === 'fr' ? captionFr : captionEn;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      alert('Copy failed — select the text and copy manually');
    }
  }

  const current = lang === 'fr' ? captionFr : captionEn;
  const setCurrent = lang === 'fr' ? setCaptionFr : setCaptionEn;
  const chars = current.length;

  return (
    <div className="card-pad border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-primary font-semibold text-sm">Post caption</div>
          <div className="text-text-secondary text-xs mt-0.5">
            The text that sits above the media when you publish. Platform-aware — each format has different length + hashtag norms.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input py-1 text-xs w-28"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            disabled={busy}
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {hasFrBody && (
            <label className="text-[11px] text-text-secondary flex items-center gap-1 whitespace-nowrap">
              <input
                type="checkbox"
                checked={bilingual}
                onChange={(e) => setBilingual(e.target.checked)}
                disabled={busy}
              />
              + FR
            </label>
          )}
          <button
            className="btn-primary text-xs"
            onClick={generate}
            disabled={busy}
          >
            {busy ? 'Generating…' : captionEn ? 'Regenerate' : 'Generate caption'}
          </button>
        </div>
      </div>

      {(captionEn || busy) && (
        <>
          {captionFr && (
            <div className="flex items-center gap-1 -mb-1">
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 text-[11px] rounded-md ${lang === 'en' ? 'bg-[#1f1f1f] text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >🇬🇧 English</button>
              <button
                onClick={() => setLang('fr')}
                className={`px-2 py-1 text-[11px] rounded-md ${lang === 'fr' ? 'bg-[#1f1f1f] text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              >🇫🇷 Français</button>
            </div>
          )}
          <textarea
            className="input font-mono text-xs min-h-[100px]"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder={busy ? 'Writing caption…' : `Click "Generate caption" above, or paste your own for ${platform}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
            <span>{chars} chars · {platform}{lang === 'fr' ? ' · French' : ''}</span>
            <div className="flex gap-2">
              <button className="btn text-xs" onClick={() => copy(lang)} disabled={!current}>
                {copied === lang ? 'Copied' : `Copy ${lang.toUpperCase()}`}
              </button>
              <button className="btn-primary text-xs" onClick={save} disabled={saving || busy || !captionEn}>
                {saving ? 'Saving…' : savedAt ? 'Saved' : 'Save caption'}
              </button>
            </div>
          </div>
        </>
      )}

      {error && <div className="text-danger text-xs">{error}</div>}
    </div>
  );
}
