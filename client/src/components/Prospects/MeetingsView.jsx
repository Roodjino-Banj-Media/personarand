import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function MeetingsView() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [showBook, setShowBook] = useState(false);

  async function load() {
    setLoading(true);
    try { setMeetings(await api.meetings.list()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const now = new Date().toISOString();
  const upcoming = meetings.filter((m) => m.scheduled_date > now && m.status === 'scheduled');
  const past = meetings.filter((m) => m.scheduled_date <= now || m.status !== 'scheduled');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-text-secondary">Meeting records feed prospect stage changes + attribution.</div>
        <button className="btn-primary" onClick={() => setShowBook(true)}>+ Book meeting</button>
      </div>
      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : (
        <>
          <section>
            <div className="section-title">Upcoming ({upcoming.length})</div>
            {upcoming.length === 0 ? (
              <div className="card-pad text-text-secondary text-sm">No upcoming meetings.</div>
            ) : (
              <div className="space-y-2">{upcoming.map((m) => <MeetingRow key={m.id} m={m} onOpen={() => setActive(m)} />)}</div>
            )}
          </section>
          <section>
            <div className="section-title">Past / completed</div>
            {past.length === 0 ? (
              <div className="card-pad text-text-secondary text-sm">No past meetings yet.</div>
            ) : (
              <div className="space-y-2">{past.slice(0, 30).map((m) => <MeetingRow key={m.id} m={m} onOpen={() => setActive(m)} />)}</div>
            )}
          </section>
        </>
      )}
      {active && <MeetingModal meeting={active} onClose={() => setActive(null)} onSaved={async () => { setActive(null); await load(); }} />}
      {showBook && <BookMeetingModal onClose={() => setShowBook(false)} onSaved={async () => { setShowBook(false); await load(); }} />}
    </div>
  );
}

function MeetingRow({ m, onOpen }) {
  return (
    <div className="card-pad cursor-pointer hover:border-[#555] transition-colors" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{m.prospect_name} {m.prospect_company ? `@ ${m.prospect_company}` : ''}</div>
          <div className="text-[11px] text-text-secondary mt-0.5">
            {m.meeting_type || 'meeting'} · {m.duration}min · {m.scheduled_date?.slice(0, 16).replace('T', ' ')}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`pill ${statusPill(m.status)}`}>{m.status}</span>
          {m.outcome && <div className="text-[10px] text-text-secondary mt-1 capitalize">{m.outcome.replace(/_/g, ' ')}</div>}
        </div>
      </div>
    </div>
  );
}

function statusPill(status) {
  if (status === 'completed') return 'border-success/40 text-success bg-success/5';
  if (status === 'scheduled') return 'border-blue-500/40 text-blue-300 bg-blue-500/10';
  if (status === 'no_show') return 'border-danger/40 text-danger bg-danger/5';
  if (status === 'cancelled') return 'border-border text-text-secondary opacity-60';
  return 'border-border text-text-secondary';
}

function BookMeetingModal({ onClose, onSaved }) {
  const [prospects, setProspects] = useState([]);
  const [form, setForm] = useState({ prospect_id: '', scheduled_date: '', duration: 30, meeting_type: 'discovery', location: '', prep_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.prospects.list().then(setProspects); }, []);

  async function save() {
    if (!form.prospect_id || !form.scheduled_date) { alert('Prospect + date required'); return; }
    setSaving(true);
    try {
      await api.meetings.create(form);
      onSaved();
    } catch (err) { alert(err.message); setSaving(false); }
  }

  return (
    <Modal title="Book meeting" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <div className="label">Prospect *</div>
          <select className="input" value={form.prospect_id} onChange={(e) => setForm({ ...form, prospect_id: e.target.value })}>
            <option value="">Select…</option>
            {prospects.map((p) => <option key={p.id} value={p.id}>{p.name} {p.company ? `(${p.company})` : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Date + time *</div>
            <input type="datetime-local" className="input" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </div>
          <div>
            <div className="label">Duration (min)</div>
            <input type="number" className="input font-mono" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Type</div>
            <select className="input" value={form.meeting_type} onChange={(e) => setForm({ ...form, meeting_type: e.target.value })}>
              <option value="discovery">Discovery</option>
              <option value="demo">Demo / presentation</option>
              <option value="proposal">Proposal discussion</option>
              <option value="closing">Closing</option>
            </select>
          </div>
          <div>
            <div className="label">Location / link</div>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zoom link, office, phone" />
          </div>
        </div>
        <div>
          <div className="label">Prep notes</div>
          <textarea className="input min-h-[70px]" value={form.prep_notes} onChange={(e) => setForm({ ...form, prep_notes: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-6 px-6 -mb-6 pb-6 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Booking…' : 'Book'}</button>
      </div>
    </Modal>
  );
}

function MeetingModal({ meeting, onClose, onSaved }) {
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    outcome: '', meeting_notes: '', key_takeaways: '', pain_points_identified: '',
    budget_signals: '', decision_makers: '', timeline: '', next_steps: '', deal_value: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.meetings.get(meeting.id).then(setDetail); }, [meeting.id]);

  async function complete() {
    if (!form.outcome) { alert('Pick an outcome'); return; }
    setSaving(true);
    try {
      await api.meetings.complete(meeting.id, form);
      onSaved();
    } catch (err) { alert(err.message); setSaving(false); }
  }

  return (
    <Modal title={`Meeting: ${meeting.prospect_name}`} onClose={onClose}>
      <div className="text-xs text-text-secondary mb-3">
        {meeting.meeting_type} · {meeting.scheduled_date?.slice(0, 16).replace('T', ' ')} · {meeting.duration}min · {meeting.status}
      </div>

      {detail && (
        <div className="card-pad !bg-[#0f0f0f] !border-[#2a2a2a] text-xs space-y-1 mb-3">
          {detail.prospect_pain_points && <div><strong>Pain points:</strong> {detail.prospect_pain_points}</div>}
          {detail.prior_emails?.length > 0 && <div><strong>Prior emails:</strong> {detail.prior_emails.length} sent, {detail.prior_emails.filter((e) => e.replied_at).length} replied</div>}
          {detail.prep_notes && <div><strong>Prep:</strong> {detail.prep_notes}</div>}
        </div>
      )}

      {meeting.status !== 'completed' && (
        <div className="space-y-3">
          <div>
            <div className="label">Outcome *</div>
            <select className="input" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
              <option value="">Select outcome…</option>
              <option value="qualified">✅ Qualified — ready for proposal</option>
              <option value="needs_nurturing">⚠ Needs nurturing — not ready</option>
              <option value="not_fit">❌ Not a fit — archive</option>
              <option value="follow_up">🔄 Needs follow-up meeting</option>
              <option value="proposal_sent">📝 Proposal sent</option>
              <option value="closed_won">💰 Closed — won</option>
            </select>
          </div>
          {form.outcome === 'closed_won' && (
            <div>
              <div className="label">Deal value ($)</div>
              <input className="input font-mono" inputMode="numeric" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextArea label="Key takeaways" value={form.key_takeaways} onChange={(v) => setForm({ ...form, key_takeaways: v })} />
            <TextArea label="Pain points identified" value={form.pain_points_identified} onChange={(v) => setForm({ ...form, pain_points_identified: v })} />
            <TextArea label="Budget signals" value={form.budget_signals} onChange={(v) => setForm({ ...form, budget_signals: v })} />
            <TextArea label="Decision makers" value={form.decision_makers} onChange={(v) => setForm({ ...form, decision_makers: v })} />
            <TextArea label="Timeline" value={form.timeline} onChange={(v) => setForm({ ...form, timeline: v })} />
            <TextArea label="Next steps" value={form.next_steps} onChange={(v) => setForm({ ...form, next_steps: v })} />
          </div>
          <TextArea label="Full notes" value={form.meeting_notes} onChange={(v) => setForm({ ...form, meeting_notes: v })} rows={5} />
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={complete} disabled={saving}>{saving ? 'Saving…' : 'Complete meeting'}</button>
          </div>
        </div>
      )}

      {meeting.status === 'completed' && detail && (
        <div className="space-y-2 text-sm">
          <div><strong>Outcome:</strong> {detail.outcome?.replace(/_/g, ' ')}</div>
          {detail.key_takeaways && <div><strong>Takeaways:</strong> {detail.key_takeaways}</div>}
          {detail.next_steps && <div><strong>Next steps:</strong> {detail.next_steps}</div>}
          {detail.meeting_notes && <div className="whitespace-pre-wrap pt-2 border-t border-border"><strong>Notes:</strong><br/>{detail.meeting_notes}</div>}
        </div>
      )}
    </Modal>
  );
}

function TextArea({ label, value, onChange, rows = 2 }) {
  return (
    <div>
      <div className="label">{label}</div>
      <textarea className="input" style={{ minHeight: `${rows * 28}px` }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto bg-black/70">
      <div className="card w-full max-w-3xl my-4">
        <div className="px-6 py-4 border-b border-border flex items-start justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
