// All templates render at their export size. Visual scaling happens in the Studio frame.
// Each template accepts the same props: { headline, body, visual, slideIndex, totalSlides }

const SIZE = 1080;

function Frame({ children, bg = '#0a0a0a' }) {
  return (
    <div
      style={{
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        background: bg,
        color: '#e0e0e0',
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

function PageCounter({ slideIndex, totalSlides, color = 'rgba(255,255,255,0.4)' }) {
  return (
    <div style={{
      position: 'absolute', bottom: '40px', right: '60px',
      fontSize: '22px', fontWeight: 500, color,
      fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em',
    }}>
      {String(slideIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
    </div>
  );
}

function Brand({ color = 'rgba(255,255,255,0.5)' }) {
  return (
    <div style={{
      position: 'absolute', bottom: '40px', left: '60px',
      fontSize: '20px', fontWeight: 500,
      color, letterSpacing: '0.15em', textTransform: 'uppercase',
    }}>
      Roodjino
    </div>
  );
}

function TextHeavy({ headline, body, slideIndex, totalSlides }) {
  const isCover = slideIndex === 0;
  const isCTA = slideIndex === totalSlides - 1;
  return (
    <Frame bg="#0a0a0a">
      <div style={{
        padding: '100px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, gap: '40px',
      }}>
        <div style={{
          fontSize: isCover ? '100px' : '72px',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em',
          color: '#ffffff',
        }}>
          {headline || (isCover ? '(Cover headline)' : '(headline)')}
        </div>
        {!isCover && body && (
          <div style={{
            fontSize: '38px', lineHeight: 1.45,
            color: '#c8c8c8', whiteSpace: 'pre-wrap',
          }}>
            {body}
          </div>
        )}
        {isCTA && body && (
          <div style={{
            marginTop: '40px', fontSize: '28px', fontWeight: 600,
            color: '#0066ff', letterSpacing: '0.02em',
          }}>
            →
          </div>
        )}
      </div>
      <Brand />
      {!isCover && <PageCounter slideIndex={slideIndex} totalSlides={totalSlides} />}
    </Frame>
  );
}

function QuoteMinimal({ headline, body, slideIndex, totalSlides }) {
  return (
    <Frame bg="#0a0a0a">
      <div style={{
        padding: '120px 100px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, textAlign: 'center', alignItems: 'center',
      }}>
        <div style={{
          fontSize: '20px', color: '#0066ff', fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '60px',
        }}>
          {slideIndex === 0 ? 'A thesis' : slideIndex === totalSlides - 1 ? 'Last slide' : `Slide ${String(slideIndex + 1).padStart(2, '0')}`}
        </div>
        <div style={{
          fontSize: '84px', fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', color: '#ffffff', maxWidth: '880px',
        }}>
          {headline || '(one strong line)'}
        </div>
        {body && (
          <div style={{
            marginTop: '48px', fontSize: '32px', lineHeight: 1.5,
            color: '#999', maxWidth: '780px',
          }}>
            {body}
          </div>
        )}
      </div>
      <Brand />
      {slideIndex > 0 && <PageCounter slideIndex={slideIndex} totalSlides={totalSlides} />}
    </Frame>
  );
}

function DataViz({ headline, body, slideIndex, totalSlides }) {
  const firstBodyLine = (body || '').split('\n')[0] || '';
  const rest = (body || '').split('\n').slice(1).join('\n');
  return (
    <Frame bg="#0a0a0a">
      <div style={{
        padding: '100px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, gap: '50px',
      }}>
        <div style={{
          fontSize: '32px', color: '#0066ff', fontWeight: 600,
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          {headline || '(headline)'}
        </div>
        <div style={{
          fontSize: '220px', fontWeight: 800, lineHeight: 0.95,
          letterSpacing: '-0.04em', color: '#ffffff',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {firstBodyLine || '—'}
        </div>
        {rest && (
          <div style={{
            fontSize: '36px', lineHeight: 1.4,
            color: '#c8c8c8', whiteSpace: 'pre-wrap',
          }}>
            {rest}
          </div>
        )}
      </div>
      <Brand />
      <PageCounter slideIndex={slideIndex} totalSlides={totalSlides} />
    </Frame>
  );
}

function FrameworkBreakdown({ headline, body, slideIndex, totalSlides }) {
  return (
    <Frame bg="#0a0a0a">
      <div style={{
        padding: '100px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        flex: 1, gap: '36px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px' }}>
          <div style={{
            fontSize: '180px', fontWeight: 800, lineHeight: 0.9,
            color: '#0066ff', letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {String(slideIndex + 1).padStart(2, '0')}
          </div>
          <div style={{
            fontSize: '26px', color: '#666', fontWeight: 500,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            transform: 'translateY(-20px)',
          }}>
            Step {slideIndex + 1} of {totalSlides}
          </div>
        </div>
        <div style={{
          fontSize: '72px', fontWeight: 700, lineHeight: 1.1,
          letterSpacing: '-0.02em', color: '#ffffff',
        }}>
          {headline || '(step name)'}
        </div>
        {body && (
          <div style={{
            fontSize: '34px', lineHeight: 1.5,
            color: '#c8c8c8', whiteSpace: 'pre-wrap', maxWidth: '880px',
          }}>
            {body}
          </div>
        )}
      </div>
      <Brand />
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
      headline={slide.headline}
      body={slide.body}
      visual={slide.visual}
      slideIndex={slideIndex}
      totalSlides={totalSlides}
    />
  );
}

export const EXPORT_SIZE = SIZE;
