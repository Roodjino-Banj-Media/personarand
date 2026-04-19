import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function DailyOutreach() {
  const [stats, setStats] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [personalizing, setPersonalizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [goal] = useState(40);

  async function loadAll() {
    const [s, p, t] = await Promise.all([
      api.outreach.dailyStats().catch(() => null),
      api.prospects.list({}).catch(() => []),
      api.emailTemplates.list().catch(() => []),
    ]);
    setStats(s);
    setProspects(p || []);
    setTemplates(t || []);
  }
  useEffect(() => { loadAll(); }, []);

  async function handleTemplateChange(id) {
    const t = templates.find((x) => x.id === Number(id));
    setSelectedTemplate(t);
    if (t) { setSubject(t.subject_line); setBody(t.body); }
  }

  async function personalize() {
    if (!selectedProspect || !selectedTemplate) { setMsg('Pick a prospect + template first.'); return; }
    setPersonalizing(true);
    setMsg(null);
    try {
      const r = await api.outreach.aiPersonalize({ prospect_id: selectedProspect.id, template_id: selectedTemplate.id });
      setSubject(r.subject);
      setBody(r.body);
      setMsg(r.parse_error ? 'AI output had formatting issues — showing template unchanged.' : 'Personalized. Review + edit before sending.');
    } catch (err) { setMsg(`Failed: ${err.message}`); }
    finally { setPersonalizing(false); }
  }

  async function send() {
    if (!selectedProspect || !subject || !body) { setMsg('Pick a prospect and fill the email.'); return; }
    setSending(true);
    setMsg(null);
    try {
      const r = await api.outreach.send({
        prospect_id: selectedProspect.id,
        template_id: selectedTemplate?.id,
        subject, body,
      });
      setMsg(r.delivered ? `Sent to ${selectedProspect.email}.` : `Logged but not delivered: ${r.reason || 'Resend not configured'}.`);
      setSelectedProspect(null);
      setSubject('');
      setBody('');
      await loadAll();
    } catch (err) { setMsg(`Failed: ${err.message}`); }
    finally { setSending(false); }
  }

  const progress = stats ? Math.min(100, Math.round((stats.emails_today / goal) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-pad">
          <div className="section-title !mb-2">Today&#39;s goal</div>
          <div className="text-4xl font-semibold font-mono">{stats?.emails_today || 0} / {goal}</div>
          <div className="mt-3 h-2 rounded-full bg-[#1f1f1f] overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Responses" value={stats?.responses_today || 0} />
            <Stat label="Meetings" value={stats?.meetings_booked_today || 0} />
            <Stat label="Remaining" value={Math.max(0, goal - (stats?.emails_today || 0))} />
          </div>
        </div>
        <div className="card-pad">
          <div className="section-title !mb-2">7-day pressure</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-text-secondary uppercase tracking-wider">Emails / day</div>
              <div className="text-2xl font-semibold font-mono">{stats?.avg_7_day || 0}</div>
            </div>
            <div>
              <div className="text-[11px] text-text-secondary uppercase tracking-wider">Response rate</div>
              <div className="text-2xl font-semibold font-mono">{stats?.response_rate_7d != null ? `${stats.response_rate_7d}%` : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-pad space-y-3">
        <div className="section-title !mb-0">Quick send</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="label">Prospect</div>
            <select className="input" value={selectedProspect?.id || ''} onChange={(e) => setSelectedProspect(prospects.find((p) => p.id === Number(e.target.value)) || null)}>
              <option value="">Select prospect…</option>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.name} {p.company ? `(${p.company})` : ''}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Template</div>
            <select className="input" value={selectedTemplate?.id || ''} onChange={(e) => handleTemplateChange(e.target.value)}>
              <option value="">Select template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.best_for}{t.response_rate != null ? ` · ${t.response_rate}% reply` : ''}</option>)}
            </select>
          </div>
        </div>

        {selectedProspect && (
          <div className="card-pad !bg-[#0f0f0f] !border-[#2a2a2a] text-xs space-y-1">
            <div><strong>Prospect context:</strong> {selectedProspect.title || '—'} at {selectedProspect.company || '—'} · Stage: {selectedProspect.stage}</div>
            {selectedProspect.pain_points && <div className="text-text-secondary">Pain: {selectedProspect.pain_points}</div>}
            {!selectedProspect.linkedin_context && <div className="text-warning">⚠ No LinkedIn context on file — AI personalization will be generic. Edit prospect to add.</div>}
          </div>
        )}

        <div className="flex justify-between items-center">
          <button className="btn" onClick={personalize} disabled={personalizing || !selectedProspect || !selectedTemplate}>
            {personalizing ? 'AI personalizing…' : 'AI personalize'}
          </button>
          <div className="text-[11px] text-text-secondary">Edit before sending.</div>
        </div>

        <div>
          <div className="label">Subject</div>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <div className="label">Body</div>
          <textarea className="input font-mono text-sm min-h-[240px] whitespace-pre-wrap" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div className="flex justify-between items-center">
          {msg && <div className="text-xs text-text-secondary">{msg}</div>}
          <button className="btn-primary ml-auto" onClick={send} disabled={sending || !selectedProspect}>
            {sending ? 'Sending…' : 'Send + log'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-2xl font-semibold font-mono">{value}</div>
      <div className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</div>
    </div>
  );
}
