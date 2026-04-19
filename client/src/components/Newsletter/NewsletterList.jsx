import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function NewsletterList({ onOpen }) {
  const [issues, setIssues] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [list, ov] = await Promise.all([
        api.newsletter.list(),
        api.newsletter.overview().catch(() => null),
      ]);
      setIssues(list || []);
      setOverview(ov);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this issue? This removes the draft and any linked engagement data.')) return;
    try {
      await api.newsletter.remove(id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6">
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active subscribers" value={overview.total_subscribers} />
          <Stat label="Issues sent" value={overview.issues_sent} />
          <Stat label="Avg open rate" value={overview.avg_open_rate != null ? `${overview.avg_open_rate}%` : '—'} />
          <Stat label="Avg click rate" value={overview.avg_click_rate != null ? `${overview.avg_click_rate}%` : '—'} />
        </div>
      )}

      {overview && !overview.esp_configured && (
        <div className="card-pad border-warning/40 bg-warning/5 text-sm">
          <div className="text-warning font-medium">Resend not configured.</div>
          <div className="text-text-secondary text-xs mt-1">
            Add RESEND_API_KEY + RESEND_FROM_EMAIL in <code>.env</code> and restart the server.
            Until then, Send will log to the DB but no actual email will transmit.
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="card-pad text-text-secondary text-sm">
          No issues yet. Click <strong>+ New issue</strong> to draft one, or use <em>Expand from social</em> inside the composer to turn recent posts into a deep-dive.
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} onOpen={() => onOpen(issue.id)} onDelete={() => handleDelete(issue.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue, onOpen, onDelete }) {
  const sent = issue.status === 'sent';
  return (
    <div className="card-pad hover:border-[#555] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2">
            <span className={`pill ${statusPill(issue.status)}`}>{issue.status}</span>
            <span className="text-[11px] text-text-secondary">{issue.template_type}</span>
          </div>
          <div className="text-base font-semibold mt-1">{issue.title}</div>
          <div className="text-sm text-text-secondary mt-0.5 truncate">{issue.subject_line}</div>
          {sent && (
            <div className="text-[11px] text-text-secondary mt-2 flex flex-wrap gap-3 font-mono">
              <span>Sent {issue.sent_at?.slice(0, 10)}</span>
              <span>to {issue.total_sent}</span>
              <span>{issue.open_rate != null ? `${issue.open_rate}% open` : '—'}</span>
              <span>{issue.click_rate != null ? `${issue.click_rate}% click` : '—'}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-ghost text-xs" onClick={onOpen}>Open</button>
          {!sent && (
            <button className="btn-ghost text-xs text-danger" onClick={onDelete}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

function statusPill(status) {
  switch (status) {
    case 'draft': return 'border-border text-text-secondary';
    case 'scheduled': return 'border-blue-500/40 text-blue-300 bg-blue-500/10';
    case 'sent': return 'border-success/40 text-success bg-success/5';
    default: return 'border-border text-text-secondary';
  }
}

function Stat({ label, value }) {
  return (
    <div className="card-pad">
      <div className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className="text-2xl font-semibold mt-1 font-mono">{value ?? '—'}</div>
    </div>
  );
}
