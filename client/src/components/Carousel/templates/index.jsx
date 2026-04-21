// All templates render at their export size. Visual scaling happens in the Studio frame.
// Each template accepts the same props: { slide, slideIndex, totalSlides }
// where slide = { headline, body, visual, style? }
//
// Styling (per-slide override, falls back to template defaults):
//   slide.style.bg           → string color OR { type: 'gradient', from, to, angle? }
//   slide.style.textColor    → headline color (falls back to template default)
//   slide.style.bodyColor    → body text color
//   slide.style.accentColor  → accent / page-counter color
//   slide.style.textScale    → multiplier for every font-size (e.g. 0.85, 1.0, 1.2)

const SIZE = 1080;

export const DEFAULT_BG = '#0a0a0a';
export const DEFAULT_ACCENT = '#0066ff';

// Curated palette presets — one click applies bg, textColor, accentColor together.
// Design choice: keep to ~8 looks that actually ship well. Too many choices = paralysis.
export const STYLE_PRESETS = [
  { key: 'midnight',   label: 'Midnight',       bg: '#0a0a0a',                             textColor: '#ffffff', bodyColor: '#c8c8c8', accentColor: '#0066ff' },
  { key: 'ivory',      label: 'Ivory',          bg: '#f5f2ed',                             textColor: '#1a1a1a', bodyColor: '#4a4a4a', accentColor: '#0052cc' },
  { key: 'ocean',      label: 'Ocean gradient', bg: { type: 'gradient', from: '#0b1a3a', to: '#1f4a7a', angle: 145 }, textColor: '#ffffff', bodyColor: '#cfe0f5', accentColor: '#67d1ff' },
  { key: 'sunset',     label: 'Sunset gradient',bg: { type: 'gradient', from: '#3b0a2a', to: '#d8502c', angle: 145 }, textColor: '#fff8f0', bodyColor: '#ffd7b8', accentColor: '#ffce63' },
  { key: 'forest',     label: 'Forest',         bg: '#0d1f15',                             textColor: '#e8f5e8', bodyColor: '#9fc7a8', accentColor: '#4bc97e' },
  { key: 'amber',      label: 'Amber mono',     bg: '#1a0d00',                             textColor: '#ffc26e', bodyColor: '#e8a043', accentColor: '#ff8800' },
  { key: 'haitian',    label: 'Haitian',        bg: { type: 'gradient', from: '#00209f', to: '#d21034', angle: 180 }, textColor: '#ffffff', bodyColor: '#f0e8d8', accentColor: '#fff1a8' },
  { key: 'paper',      label: 'Paper',          bg: '#fafaf5',                             textColor: '#1a1a1a', bodyColor: '#555555', accentColor: '#d24d28' },
];

// Shape the background descriptor into a CSS `background` value.
export function cssBackground(bg) {
  if (!bg) return DEFAULT_BG;
  if (typeof bg === 'string') return bg;
  if (bg.type === 'gradient') {
    const angle = bg.angle ?? 135;
    const from = bg.from || '#0a0a0a';
    const to = bg.to || '#1f1f1f';
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  return DEFAULT_BG;
}

// Resolve style values with defaults. Each template calls this once and uses the result.
function resolveStyle(slide, defaults = {}) {
  const s = slide?.style || {};
  return {
    bg: cssBackground(s.bg ?? defaults.bg ?? DEFAULT_BG),
    textColor: s.textColor ?? defaults.textColor ?? '#ffffff',
    bodyColor: s.bodyColor ?? defaults.bodyColor ?? '#c8c8c8',
    accentColor: s.accentColor ?? defaults.accentColor ?? DEFAULT_ACCENT,
    textScale: typeof s.textScale === 'number' ? s.textScale : 1,
  };
}

// Scale a px number and return a string with "px" suffix.
function px(base, scale) {
  return `${Math.round(base * scale)}px`;
}

function Frame({ children, bg, slide }) {
  return (
    <div
      style={{
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        background: bg,
        color: slide?.style?.textColor ?? '#e0e0e0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function PageCounter({ slideIndex, totalSlides, color, scale }) {
  return (
    <div style={{
      position: 'absolute', bottom: '40px', right: '60px',
      fontSize: px(22, scale), fontWeight: 500, color,
      fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em',
    }}>
      {String(slideIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
    </div>
  );
}

function Brand({ color, scale }) {
  return (
    <div style={{
      position: 'absolute', bottom: '40px', left: '60px',
      fontSize: px(20, scale), fontWeight: 500,
      color, letterSpacing: '0.15em', textTransform: 'uppercase',
    }}>
      Roodjino
    </div>
  );
}

function TextHeavy({ slide, slideIndex, totalSlides }) {
  const { headline, body } = slide;
  const s = resolveStyle(slide, { bg: '#0a0a0a', textColor: '#ffffff', bodyColor: '#c8c8c8', accentColor: DEFAULT_ACCENT });
  const isCover = slideIndex === 0;
  const isCTA = slideIndex === totalSlides - 1;
  return (
    <Frame bg={s.bg} slide={slide}>
      <div style={{
        padding: '100px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, gap: '40px',
      }}>
        <div style={{
          fontSize: px(isCover ? 100 : 72, s.textScale),
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em',
          color: s.textColor,
        }}>
          {headline || (isCover ? '(Cover headline)' : '(headline)')}
        </div>
        {!isCover && body && (
          <div style={{
            fontSize: px(38, s.textScale), lineHeight: 1.45,
            color: s.bodyColor, whiteSpace: 'pre-wrap',
          }}>
            {body}
          </div>
        )}
        {isCTA && body && (
          <div style={{
            marginTop: '40px', fontSize: px(28, s.textScale), fontWeight: 600,
            color: s.accentColor, letterSpacing: '0.02em',
          }}>
            →
          </div>
        )}
      </div>
      <Brand color={`${s.textColor}80`} scale={s.textScale} />
      {!isCover && <PageCounter slideIndex={slideIndex} totalSlides={totalSlides} color={`${s.textColor}80`} scale={s.textScale} />}
    </Frame>
  );
}

function QuoteMinimal({ slide, slideIndex, totalSlides }) {
  const { headline, body } = slide;
  const s = resolveStyle(slide, { bg: '#0a0a0a', textColor: '#ffffff', bodyColor: '#999999', accentColor: DEFAULT_ACCENT });
  return (
    <Frame bg={s.bg} slide={slide}>
      <div style={{
        padding: '120px 100px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, textAlign: 'center', alignItems: 'center',
      }}>
        <div style={{
          fontSize: px(20, s.textScale), color: s.accentColor, fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '60px',
        }}>
          {slideIndex === 0 ? 'A thesis' : slideIndex === totalSlides - 1 ? 'Last slide' : `Slide ${String(slideIndex + 1).padStart(2, '0')}`}
        </div>
        <div style={{
          fontSize: px(84, s.textScale), fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', color: s.textColor, maxWidth: '880px',
        }}>
          {headline || '(one strong line)'}
        </div>
        {body && (
          <div style={{
            marginTop: '48px', fontSize: px(32, s.textScale), lineHeight: 1.5,
            color: s.bodyColor, maxWidth: '780px',
          }}>
            {body}
          </div>
        )}
      </div>
      <Brand color={`${s.textColor}80`} scale={s.textScale} />
      {slideIndex > 0 && <PageCounter slideIndex={slideIndex} totalSlides={totalSlides} color={`${s.textColor}80`} scale={s.textScale} />}
    </Frame>
  );
}

function DataViz({ slide, slideIndex, totalSlides }) {
  const { headline, body } = slide;
  const s = resolveStyle(slide, { bg: '#0a0a0a', textColor: '#ffffff', bodyColor: '#c8c8c8', accentColor: DEFAULT_ACCENT });
  const firstBodyLine = (body || '').split('\n')[0] || '';
  const rest = (body || '').split('\n').slice(1).join('\n');
  return (
    <Frame bg={s.bg} slide={slide}>
      <div style={{
        padding: '100px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, gap: '50px',
      }}>
        <div style={{
          fontSize: px(32, s.textScale), color: s.accentColor, fontWeight: 600,
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          {headline || '(headline)'}
        </div>
        <div style={{
          fontSize: px(220, s.textScale), fontWeight: 800, lineHeight: 0.95,
          letterSpacing: '-0.04em', color: s.textColor,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {firstBodyLine || '—'}
        </div>
        {rest && (
          <div style={{
            fontSize: px(36, s.textScale), lineHeight: 1.4,
            color: s.bodyColor, whiteSpace: 'pre-wrap',
          }}>
            {rest}
          </div>
        )}
      </div>
      <Brand color={`${s.textColor}80`} scale={s.textScale} />
      <PageCounter slideIndex={slideIndex} totalSlides={totalSlides} color={`${s.textColor}80`} scale={s.textScale} />
    </Frame>
  );
}

function FrameworkBreakdown({ slide, slideIndex, totalSlides }) {
  const { headline, body } = slide;
  const s = resolveStyle(slide, { bg: '#0a0a0a', textColor: '#ffffff', bodyColor: '#c8c8c8', accentColor: DEFAULT_ACCENT });
  return (
    <Frame bg={s.bg} slide={slide}>
      <div style={{
        padding: '100px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, gap: '36px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px' }}>
          <div style={{
            fontSize: px(180, s.textScale), fontWeight: 800, lineHeight: 0.9,
            color: s.accentColor, letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {String(slideIndex + 1).padStart(2, '0')}
          </div>
          <div style={{
            fontSize: px(26, s.textScale), color: `${s.textColor}66`, fontWeight: 500,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            transform: 'translateY(-20px)',
          }}>
            Step {slideIndex + 1} of {totalSlides}
          </div>
        </div>
        <div style={{
          fontSize: px(72, s.textScale), fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', color: s.textColor,
        }}>
          {headline || '(step name)'}
        </div>
        {body && (
          <div style={{
            fontSize: px(34, s.textScale), lineHeight: 1.5,
            color: s.bodyColor, whiteSpace: 'pre-wrap', maxWidth: '880px',
          }}>
            {body}
          </div>
        )}
      </div>
      <Brand color={`${s.textColor}80`} scale={s.textScale} />
    </Frame>
  );
}

export const TEMPLATES = {
  'text-heavy': { label: 'Text-Heavy Educational', component: TextHeavy, description: 'Frameworks, breakdowns, long-form argument' },
  'quote-minimal': { label: 'Quote-Driven Minimal', component: QuoteMinimal, description: 'Single punchy statement, centered' },
  'data-viz': { label: 'Data Visualization', component: DataViz, description: 'Large stat, small supporting text' },
  'framework': { label: 'Framework Breakdown', component: FrameworkBreakdown, description: 'Numbered step-by-step' },
};

export function SlideRenderer({ templateKey, slide, slideIndex, totalSlides }) {
  const tpl = TEMPLATES[templateKey] || TEMPLATES['text-heavy'];
  const Component = tpl.component;
  return (
    <Component
      slide={slide}
      slideIndex={slideIndex}
      totalSlides={totalSlides}
    />
  );
}

export const EXPORT_SIZE = SIZE;
