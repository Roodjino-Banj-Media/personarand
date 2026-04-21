import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { copyToClipboard } from '../../lib/clipboard.js';
import { TEMPLATES, SlideRenderer, EXPORT_SIZE, STYLE_PRESETS } from './templates/index.jsx';
import { exportNodeToPng, exportNodesToPdf } from './export.js';

export default function CarouselView() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const rows = await api.carousels.list();
      setDesigns(rows || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createBlank() {
    const created = await api.carousels.create({
      title: 'New carousel',
      slides: [
        { headline: 'Cover headline', body: '', visual: 'Bold cover, typographic hierarchy' },
        { headline: 'Slide 2', body: 'First supporting point.', visual: '' },
        { headline: 'CTA', body: 'What the reader should do next.', visual: '' },
      ],
      template_style: 'text-heavy',
      status: 'draft',
    });
    await load();
    setActiveId(created.id);
  }

  async function handleGenerated(design) {
    await load();
    setActiveId(design.id);
    setShowGenerate(false);
  }

  const active = designs.find((d) => d.id === activeId);

  if (active) {
    return (
      <CarouselBuilder
        design={active}
        onBack={() => { setActiveId(null); load(); }}
        onDeleted={() => { setActiveId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Carousel Studio</h1>
          <p className="text-text-secondary text-sm mt-1">
            Build multi-slide posts. Edit text, pick a template, export to PNG or PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={createBlank}>+ Blank</button>
          <button className="btn-primary" onClick={() => setShowGenerate(true)}>Generate with AI</button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : designs.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">
          No carousels yet. Create a blank one, or generate from a topic.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {designs.map((d) => (
            <DesignCard key={d.id} design={d} onOpen={() => setActiveId(d.id)} />
          ))}
        </div>
      )}

      {showGenerate && (
        <GenerateCarouselModal
          onClose={() => setShowGenerate(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}

function DesignCard({ design, onOpen }) {
  const slideCount = (design.slides || []).length;
  const templateLabel = TEMPLATES[design.template_style]?.label || design.template_style;
  return (
    <div className="card-pad cursor-pointer hover:border-[#555] transition-colors" onClick={onOpen}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold truncate">{design.title}</div>
          <div className="text-[11px] text-text-secondary mt-1">
            {slideCount} slide{slideCount === 1 ? '' : 's'} · {templateLabel}
          </div>
        </div>
        <span className="pill border-border text-text-secondary">{design.status}</span>
      </div>
      {(design.slides || []).slice(0, 1).map((s, i) => (
        <div key={i} className="mt-3 text-sm text-text-secondary line-clamp-2">{s.headline}</div>
      ))}
      <div className="text-[11px] text-text-secondary mt-3">
        {new Date(design.created_at).toLocaleString()}
      </div>
    </div>
  );
}

function CarouselBuilder({ design, onBack, onDeleted }) {
  const [title, setTitle] = useState(design.title);
  const [templateKey, setTemplateKey] = useState(design.template_style || 'text-heavy');
  const [status, setStatus] = useState(design.status || 'draft');
  const [slides, setSlides] = useState(design.slides || []);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [exporting, setExporting] = useState(false);

  const slideRefs = useRef([]);

  function patchSlide(idx, patch) {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function addSlide(at) {
    const newSlide = { headline: 'New slide', body: '', visual: '' };
    setSlides((prev) => {
      const copy = [...prev];
      copy.splice(at, 0, newSlide);
      return copy;
    });
    setSelected(at);
  }
  function removeSlide(idx) {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setSelected((s) => Math.max(0, Math.min(s, slides.length - 2)));
  }
  function moveSlide(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
    setSelected(target);
  }

  async function save() {
    setSaving(true);
    try {
      await api.carousels.update(design.id, { title, slides, template_style: templateKey, status });
      setSavedAt(new Date());
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await api.carousels.remove(design.id);
      onDeleted();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  async function exportCurrentPng() {
    setExporting(true);
    try {
      const node = slideRefs.current[selected];
      if (!node) throw new Error('Slide not rendered yet');
      const safeName = `${title.replace(/[^a-z0-9-_]/gi, '_').slice(0, 40)}_slide${selected + 1}.png`;
      await exportNodeToPng(node, safeName);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }
  async function exportAllPdf() {
    setExporting(true);
    try {
      const nodes = slideRefs.current.filter(Boolean);
      if (!nodes.length) throw new Error('No slides rendered');
      const safeName = `${title.replace(/[^a-z0-9-_]/gi, '_').slice(0, 40)}.pdf`;
      await exportNodesToPdf(nodes, safeName);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const current = slides[selected] || { headline: '', body: '', visual: '' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost" onClick={onBack}>← All carousels</button>
        <div className="flex flex-wrap gap-2 items-center">
          {savedAt && <span className="text-[11px] text-success">Saved {savedAt.toLocaleTimeString()}</span>}
          <button className="btn" onClick={exportCurrentPng} disabled={exporting}>Export slide PNG</button>
          <button className="btn" onClick={exportAllPdf} disabled={exporting}>Export all PDF</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn text-danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>

      <div className="card-pad">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="label">Title</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <div className="label">Template</div>
            <select className="input" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {Object.entries(TEMPLATES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <div className="text-[11px] text-text-secondary mt-1">{TEMPLATES[templateKey]?.description}</div>
          </div>
          <div>
            <div className="label">Status</div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {['draft', 'review', 'ready', 'posted', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <div className="card-pad space-y-2 h-fit">
          <div className="flex items-center justify-between">
            <div className="section-title !mb-0">Slides · {slides.length}</div>
            <button className="btn-ghost text-xs" onClick={() => addSlide(slides.length)}>+ Add</button>
          </div>
          {slides.map((s, i) => (
            <div
              key={i}
              className={`card-pad !p-3 cursor-pointer transition-colors ${
                i === selected ? 'border-primary bg-primary/5' : 'hover:border-[#555]'
              }`}
              onClick={() => setSelected(i)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-text-secondary">
                    Slide {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="text-sm font-medium mt-0.5 truncate">
                    {s.headline || '(headline)'}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[10px] text-text-secondary">
                  <button onClick={(e) => { e.stopPropagation(); moveSlide(i, -1); }} disabled={i === 0}>↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveSlide(i, 1); }} disabled={i === slides.length - 1}>↓</button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button className="text-[10px] text-text-secondary hover:text-text-primary" onClick={(e) => { e.stopPropagation(); addSlide(i + 1); }}>+ below</button>
                {slides.length > 1 && (
                  <button className="text-[10px] text-danger opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeSlide(i); }}>remove</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <SlidePreview
            templateKey={templateKey}
            slide={current}
            slideIndex={selected}
            totalSlides={slides.length}
          />

          <div className="card-pad space-y-4">
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">
              Editing slide {selected + 1} of {slides.length}
            </div>
            <div>
              <div className="label">Headline</div>
              <input className="input" value={current.headline} onChange={(e) => patchSlide(selected, { headline: e.target.value })} />
            </div>
            <div>
              <div className="label">Body</div>
              <textarea className="input min-h-[100px]" value={current.body} onChange={(e) => patchSlide(selected, { body: e.target.value })} />
            </div>
            <div>
              <div className="label">Visual note (internal only, not rendered)</div>
              <input className="input" value={current.visual} onChange={(e) => patchSlide(selected, { visual: e.target.value })} />
            </div>
          </div>

          <SlideStylePanel
            slide={current}
            onPatch={(stylePatch) => patchSlide(selected, {
              style: { ...(current.style || {}), ...stylePatch },
            })}
            onApplyToAll={(preset) => {
              // Apply this preset to every slide — keeps the deck visually consistent.
              setSlides((prev) => prev.map((s) => ({
                ...s,
                style: { ...(s.style || {}), bg: preset.bg, textColor: preset.textColor, bodyColor: preset.bodyColor, accentColor: preset.accentColor },
              })));
            }}
            onReset={() => patchSlide(selected, { style: undefined })}
          />
        </div>
      </div>

      <OffscreenRenderer
        slides={slides}
        templateKey={templateKey}
        registerRef={(i, el) => { slideRefs.current[i] = el; }}
      />
    </div>
  );
}

function SlidePreview({ templateKey, slide, slideIndex, totalSlides }) {
  const FRAME = 560;
  const scale = FRAME / EXPORT_SIZE;
  return (
    <div className="card-pad flex items-center justify-center">
      <div style={{ width: `${FRAME}px`, height: `${FRAME}px`, overflow: 'hidden' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <SlideRenderer templateKey={templateKey} slide={slide} slideIndex={slideIndex} totalSlides={totalSlides} />
        </div>
      </div>
    </div>
  );
}

// Render full-size slides offscreen so html2canvas can capture them.
function OffscreenRenderer({ slides, templateKey, registerRef }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '-100000px',
        top: 0,
        pointerEvents: 'none',
        opacity: 0,
      }}
      aria-hidden
    >
      {slides.map((s, i) => (
        <div key={i} ref={(el) => registerRef(i, el)}>
          <SlideRenderer templateKey={templateKey} slide={s} slideIndex={i} totalSlides={slides.length} />
        </div>
      ))}
    </div>
  );
}

/**
 * Per-slide styling controls. Edits `slide.style` — each field is optional;
 * if omitted the template defaults are used.
 *
 * Structure:
 *   style.bg            string color OR { type: 'gradient', from, to, angle }
 *   style.textColor     headline color
 *   style.bodyColor     body / supporting text color
 *   style.accentColor   accent (page counter, arrow, numbers)
 *   style.textScale     multiplier on all font-sizes (0.7 - 1.4)
 */
function SlideStylePanel({ slide, onPatch, onApplyToAll, onReset }) {
  const style = slide?.style || {};
  const bg = style.bg;
  const isGradient = typeof bg === 'object' && bg?.type === 'gradient';
  const [bgMode, setBgMode] = useState(isGradient ? 'gradient' : 'solid');

  function setSolid(color) {
    onPatch({ bg: color });
  }
  function setGradient(patch) {
    const next = {
      type: 'gradient',
      from: (isGradient ? bg.from : null) || '#0b1a3a',
      to: (isGradient ? bg.to : null) || '#1f4a7a',
      angle: (isGradient ? bg.angle : null) ?? 135,
      ...patch,
    };
    onPatch({ bg: next });
  }

  const currentSolid = typeof bg === 'string' ? bg : '#0a0a0a';
  const gradFrom = isGradient ? bg.from : '#0b1a3a';
  const gradTo = isGradient ? bg.to : '#1f4a7a';
  const gradAngle = isGradient ? (bg.angle ?? 135) : 135;

  return (
    <div className="card-pad space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-text-secondary">Slide style</div>
        <button className="btn-ghost text-[11px]" onClick={onReset} title="Remove all style overrides; use template defaults">
          Reset to template default
        </button>
      </div>

      {/* One-click presets */}
      <div>
        <div className="label">Presets (click to apply to this slide)</div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {STYLE_PRESETS.map((p) => {
            const bgCss = typeof p.bg === 'string'
              ? p.bg
              : `linear-gradient(${p.bg.angle}deg, ${p.bg.from}, ${p.bg.to})`;
            return (
              <button
                key={p.key}
                className="flex flex-col items-center gap-1"
                onClick={() => onPatch({ bg: p.bg, textColor: p.textColor, bodyColor: p.bodyColor, accentColor: p.accentColor })}
                title={p.label}
              >
                <div
                  className="w-full aspect-square rounded border border-border hover:border-primary transition-colors"
                  style={{ background: bgCss }}
                />
                <div className="text-[10px] text-text-secondary truncate w-full text-center">{p.label}</div>
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-text-secondary mt-2">
          Tip: once a preset looks right,{' '}
          <button
            className="underline hover:text-primary"
            onClick={() => {
              const preset = STYLE_PRESETS.find((p) => {
                const bgMatch = typeof p.bg === 'string' ? p.bg === bg : (isGradient && p.bg.from === bg.from && p.bg.to === bg.to);
                return bgMatch;
              });
              if (preset) onApplyToAll(preset);
            }}
          >
            apply to all slides
          </button>
          {' '}for a consistent deck.
        </div>
      </div>

      {/* Background */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="label !mb-0">Background</div>
          <div className="flex rounded-md border border-border overflow-hidden ml-auto">
            {['solid', 'gradient'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setBgMode(m);
                  if (m === 'solid' && isGradient) setSolid('#0a0a0a');
                  if (m === 'gradient' && !isGradient) setGradient({});
                }}
                className={`px-2 py-1 text-[10px] transition-colors ${bgMode === m ? 'bg-primary text-white' : 'bg-[#0f0f0f] text-text-secondary hover:bg-[#1f1f1f]'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {bgMode === 'solid' && (
          <div className="flex items-center gap-2">
            <input type="color" value={currentSolid} onChange={(e) => setSolid(e.target.value)} className="w-12 h-8 rounded border border-border bg-[#0f0f0f] cursor-pointer" />
            <input className="input font-mono text-xs" value={currentSolid} onChange={(e) => setSolid(e.target.value)} placeholder="#0a0a0a" />
          </div>
        )}
        {bgMode === 'gradient' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="color" value={gradFrom} onChange={(e) => setGradient({ from: e.target.value })} className="w-12 h-8 rounded border border-border bg-[#0f0f0f] cursor-pointer" />
              <input className="input font-mono text-xs flex-1" value={gradFrom} onChange={(e) => setGradient({ from: e.target.value })} placeholder="from" />
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={gradTo} onChange={(e) => setGradient({ to: e.target.value })} className="w-12 h-8 rounded border border-border bg-[#0f0f0f] cursor-pointer" />
              <input className="input font-mono text-xs flex-1" value={gradTo} onChange={(e) => setGradient({ to: e.target.value })} placeholder="to" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-text-secondary w-16">Angle {gradAngle}°</span>
              <input
                type="range" min={0} max={360} step={5}
                value={gradAngle}
                onChange={(e) => setGradient({ angle: Number(e.target.value) })}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Text colors */}
      <div className="grid grid-cols-3 gap-2">
        <ColorPick label="Headline" value={style.textColor || '#ffffff'} onChange={(c) => onPatch({ textColor: c })} />
        <ColorPick label="Body" value={style.bodyColor || '#c8c8c8'} onChange={(c) => onPatch({ bodyColor: c })} />
        <ColorPick label="Accent" value={style.accentColor || '#0066ff'} onChange={(c) => onPatch({ accentColor: c })} />
      </div>

      {/* Text scale */}
      <div>
        <div className="flex items-center justify-between">
          <div className="label !mb-0">Text size — {Math.round((style.textScale ?? 1) * 100)}%</div>
          <button
            className="text-[11px] text-text-secondary hover:text-primary"
            onClick={() => onPatch({ textScale: 1 })}
          >
            reset
          </button>
        </div>
        <input
          type="range" min={0.7} max={1.4} step={0.05}
          value={style.textScale ?? 1}
          onChange={(e) => onPatch({ textScale: Number(e.target.value) })}
          className="w-full mt-1"
        />
        <div className="flex justify-between text-[10px] text-text-secondary mt-0.5">
          <span>smaller</span>
          <span>default</span>
          <span>larger</span>
        </div>
      </div>
    </div>
  );
}

function ColorPick({ label, value, onChange }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-8 rounded border border-border bg-[#0f0f0f] cursor-pointer shrink-0"
        />
        <input
          className="input font-mono text-[11px] min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function GenerateCarouselModal({ onClose, onGenerated }) {
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(7);
  const [templateStyle, setTemplateStyle] = useState('text-heavy');
  const [funnelLayer, setFunnelLayer] = useState('Authority');
  const [tone, setTone] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState(null);
  const [promptPreview, setPromptPreview] = useState(null);
  const [error, setError] = useState(null);

  async function submit() {
    if (!topic.trim()) { setError('Topic is required'); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await api.carousels.generate({
        topic,
        slide_count: slideCount,
        template_style: templateStyle,
        funnel_layer: funnelLayer,
        tone,
        save: true,
      });
      onGenerated(result);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function copyPrompt() {
    if (!topic.trim()) { setError('Topic is required'); return; }
    setCopying(true);
    setCopyMsg(null);
    setError(null);
    try {
      const extra = `Target exactly ${slideCount} slides. Template style: ${templateStyle}. Match tone and density to this style.`;
      const { combined } = await api.prompts.build({
        type: 'carousel',
        platform: 'LinkedIn',
        topic,
        tone,
        length: 'medium',
        funnel_layer: funnelLayer,
        extra,
      });
      const ok = await copyToClipboard(combined);
      setCopyMsg(ok
        ? 'Copied. Paste into claude.ai, refine, then bring the final slides back here.'
        : 'Copy blocked by browser. Use the preview below to select manually.');
      if (!ok) setPromptPreview(combined);
      setTimeout(() => setCopyMsg(null), 8000);
    } catch (err) {
      setError(`Copy failed: ${err.message}`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="card w-full max-w-xl">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Generate carousel</div>
            <div className="text-base font-semibold mt-1">AI-drafted slides, ready to edit</div>
          </div>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="label">Topic / brief</div>
            <textarea
              className="input min-h-[100px]"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 layers of modern communication infrastructure"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Slides</div>
              <input
                type="number" min={3} max={10}
                className="input"
                value={slideCount}
                onChange={(e) => setSlideCount(Math.max(3, Math.min(10, Number(e.target.value) || 7)))}
                disabled={busy}
              />
            </div>
            <div>
              <div className="label">Template</div>
              <select className="input" value={templateStyle} onChange={(e) => setTemplateStyle(e.target.value)} disabled={busy}>
                {Object.entries(TEMPLATES).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
              </select>
            </div>
            <div>
              <div className="label">Funnel layer</div>
              <select className="input" value={funnelLayer} onChange={(e) => setFunnelLayer(e.target.value)} disabled={busy}>
                {['Discovery', 'Authority', 'Trust', 'Conversion', 'Identity'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <div className="label">Tone</div>
              <select className="input" value={tone} onChange={(e) => setTone(e.target.value)} disabled={busy}>
                {['sharp', 'balanced', 'warm'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="text-danger text-xs">{error}</div>}
          {copyMsg && <div className="text-success text-xs leading-relaxed">{copyMsg}</div>}
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
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn" onClick={onClose} disabled={busy || copying}>Cancel</button>
            <button
              className="btn"
              onClick={copyPrompt}
              disabled={busy || copying}
              title="Copy the carousel prompt to clipboard — paste into claude.ai for unlimited refinement"
            >
              {copying ? 'Copying…' : 'Copy prompt for claude.ai'}
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy || copying}>
              {busy ? 'Generating…' : 'Generate in app (Opus 4.7)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
