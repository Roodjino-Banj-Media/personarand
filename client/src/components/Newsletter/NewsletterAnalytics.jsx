import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function NewsletterAnalytics() {
  const [issues, setIssues] = useState([]);
  const [overview, setOverview] = useState(null);
  const [subOverview, setSubOverview] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [coldList, setColdList] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [is, ov, so, lead, cold] = await Promise.all([
        api.newsletter.list(),
        api.newsletter.overview().catch(() => null),
        api.subscribers.overview().catch(() => null),
        api.subscribers.leaders().catch(() => []),
        api.subscribers.needsReengagement().catch(() => []),
      ]);
      setIssues(is || []);
      setOverview(ov);
      setSubOverview(so);
      setLeaders(lead);
      setColdList(cold);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const trend = (issues || []).filter((i) => i.status === 'sent').reverse().map((i) => ({
    label: i.sent_at?.slice(5, 10),
    open: i.open_rate,
    click: i.click_rate,
  }));

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-text-secondary">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Active subscribers" value={subOverview?.total ?? '—'} />
            <Stat label="New this week" value={subOverview?.new_this_week ?? '—'} tone="success" />
            <Stat label="Issues sent" value={overview?.issues_sent ?? 0} />
            <Stat
              label="Avg open rate"
              value={overview?.avg_open_rate != null ? `${overview.avg_open_rate}%` : '—'}
              tone={overview?.avg_open_rate >= 30 ? 'success' : overview?.avg_open_rate ? 'warning' : null}
            />
          </div>

          {trend.length >= 2 ? (
            <div className="card-pad">
              <div className="section-title !mb-3">Open / click rate by issue</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" stroke="#666" tick={{ fontSize: 11, fill: '#999' }} />
                    <YAxis stroke="#666" tick={{ fontSize: 11, fill: '#999' }} unit="%" width={50} />
                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, fontSize: 12 }} />
                    <Line type="monotone" dataKey="open" name="Open %" stroke="#00ff88" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="click" name="Click %" stroke="#4d8cff" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="card-pad text-text-secondary text-sm">Send at least 2 issues to see trend charts.</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-pad">
              <div className="section-title !mb-3">Most engaged (top 20)</div>
              {leaders.length === 0 ? (
                <div className="text-text-secondary text-sm">No engagement yet.</div>
              ) : (
                <div className="space-y-1 text-xs">
                  {leaders.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border-b border-border py-1.5">
                      <div className="min-w-0">
                        <div className="truncate">{s.email}</div>
                        <div className="text-[10px] text-text-secondary">{s.name || s.company || '—'}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span className="text-success font-semibold">{s.computed_engagement}</span>
                        <span className="text-text-secondary">{s.total_opens}o</span>
                        <span className="text-text-secondary">{s.total_clicks}c</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card-pad">
              <div className="section-title !mb-3">Needs re-engagement</div>
              {coldList.length === 0 ? (
                <div className="text-text-secondary text-sm">Everyone\u2019s engaged. Nice.</div>
              ) : (
                <div className="space-y-1 text-xs">
                  {coldList.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border-b border-border py-1.5">
                      <div className="min-w-0">
                        <div className="truncate">{s.email}</div>
                        <div className="text-[10px] text-text-secondary">
                          Subscribed {s.subscribed_at?.slice(0, 10)} · last activity {s.last_engagement_at?.slice(0, 10) || 'never'}
                        </div>
                      </div>
                      <span className="text-warning font-mono text-[11px]">{s.computed_engagement}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card-pad">
            <div className="section-title !mb-3">Issue archive</div>
            {issues.length === 0 ? (
              <div className="text-text-secondary text-sm">No issues yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-text-secondary">
                    <tr className="border-b border-border">
                      <th className="text-left px-2 py-2">Title</th>
                      <th className="text-left px-2 py-2">Status</th>
                      <th className="text-left px-2 py-2">Sent</th>
                      <th className="text-right px-2 py-2">Recipients</th>
                      <th className="text-right px-2 py-2">Opens</th>
                      <th className="text-right px-2 py-2">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((i) => (
                      <tr key={i.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 truncate max-w-xs">{i.title}</td>
                        <td className="px-2 py-2 text-text-secondary">{i.status}</td>
                        <td className="px-2 py-2 font-mono text-xs text-text-secondary">{i.sent_at?.slice(0, 10) || '—'}</td>
                        <td className="px-2 py-2 text-right font-mono">{i.total_sent || 0}</td>
                        <td className="px-2 py-2 text-right font-mono">{i.open_rate != null ? `${i.open_rate}%` : '—'}</td>
                        <td className="px-2 py-2 text-right font-mono">{i.click_rate != null ? `${i.click_rate}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-text-primary';
  return (
    <div className="card-pad">
      <div className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</div>
      <div className={`text-2xl font-semibold mt-1 font-mono ${color}`}>{value ?? '—'}</div>
    </div>
  );
}
