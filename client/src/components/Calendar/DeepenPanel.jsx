import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { copyToClipboard } from '../../lib/clipboard.js';

export default function DeepenPanel({ item, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.calendar.deepen(item.id);
      if (r.parse_error) setError(`AI output parse issue — showing raw output.`);
      setData(r);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { run(); }, [item.id]);

  async function copyAll() {
    if (!data) return;
    const text = [
      `# ${item.title}`,
      `${item.description}`,
      '',
      '## Outline',
      ...(data.outline || []).map((b, i) => `${i + 1}. ${b}`),
      '',
      '## Alternative angles',
      ...(data.alternative_angles || []).map((a, i) => `${i + 1}. ${a.angle}\n   Why: ${a.why}`),
      '',
      '## Counter-arguments to address',
      ...(data.counter_arguments || []).map((c, i) => `${i + 1}. Objection: ${c.objection}\n   Response: ${c.response}`),
      '',
      '## Supporting evidence',
      ...(data.supporting_evidence || []).map((e) => `- ${e}`),
      '',
      '## Sharpening notes',
      data.sharpening_notes || '',
    ].join('\n');
    const ok = await copyToClipboard(text);
    alert(ok ? 'Brief copied to clipboard.' : 'Copy failed — select manually.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-4xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-text-secondary">Deepen · Week {item.week} · {item.day}</div>
            <div className="text-lg font-semibold mt-1 truncate">{item.title}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn" onClick={run} disabled={loading}>{loading ? 'Thinking…' : 'Regenerate'}</button>
            <button className="btn" onClick={copyAll} disabled={!data}>Copy brief</button>
            <button className="btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-text-secondary">Thinking through the brief…</div>
          ) : error ? (
            <div className="text-danger text-sm">{error}</div>
          ) : data?.raw && !data.outline ? (
            <div>
              <div className="text-danger text-xs mb-2">Could not parse AI output cleanly. Raw response:</div>
              <pre className="text-xs font-mono bg-[#0f0f0f] p-3 rounded overflow-auto max-h-[400px] whitespace-pre-wrap">{data.raw}</pre>
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Outline">
                {data.outline?.length > 0 ? (
                  <ol className="space-y-1.5 text-sm list-decimal list-inside">
                    {data.outline.map((b, i) => <li key={i} className="leading-relaxed">{b}</li>)}
                  </ol>
                ) : <Empty />}
              </Section>

              <Section title="Alternative angles">
                {data.alternative_angles?.length > 0 ? (
                  <div className="space-y-3">
                    {data.alternative_angles.map((a, i) => (
                      <div key={i} className="border-l-2 border-primary pl-3 text-sm">
                        <div>{a.angle}</div>
                        <div className="text-[11px] text-text-secondary mt-1">Why: {a.why}</div>
                      </div>
                    ))}
                  </div>
                ) : <Empty />}
              </Section>

              <Section title="Counter-arguments to address">
                {data.counter_arguments?.length > 0 ? (
                  <div className="space-y-3">
                    {data.counter_arguments.map((c, i) => (
                      <div key={i} className="text-sm">
                        <div className="text-warning">🗣 {c.objection}</div>
                        <div className="text-text-secondary mt-1 pl-4">→ {c.response}</div>
                      </div>
                    ))}
                  </div>
                ) : <Empty />}
              </Section>

              <Section title="Supporting evidence">
                {data.supporting_evidence?.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {data.supporting_evidence.map((e, i) => <li key={i} className="leading-relaxed">• {e}</li>)}
                  </ul>
                ) : <Empty />}
              </Section>

              {data.sharpening_notes && (
                <div className="md:col-span-2">
                  <Section title="Sharpening notes">
                    <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{data.sharpening_notes}</div>
                  </Section>
                </div>
              )}
            </div>
          ) : <div className="text-text-secondary">No data.</div>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="section-title !mb-3">{title}</div>
      <div className="card-pad">{children}</div>
    </div>
  );
}

function Empty() { return <div className="text-text-secondary text-sm">—</div>; }
