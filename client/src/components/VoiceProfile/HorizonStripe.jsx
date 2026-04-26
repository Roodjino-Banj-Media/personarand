import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';

/**
 * Horizon strip — surfaces the user's stated strategic_horizon as a
 * dashboard-top reminder. Once a user has set their 6–12 month arc,
 * the most common product failure is forgetting it under daily
 * delivery pressure (Risk 4 from the strategy doc: positioning drift).
 *
 * The horizon is already in the AI's system prompt for every
 * generation. What's missing is the human-side reminder loop. This
 * widget closes that loop:
 *
 *   - Quote the horizon at the top of the Dashboard.
 *   - Show this-week's content count vs target so the user can see
 *     whether the cadence is keeping pace with the arc.
 *   - One click takes them to the Voice Profile to revise.
 *
 * Renders nothing when horizon is empty — no need to clutter cold-start
 * dashboards.
 */
export default function HorizonStripe() {
  const [horizon, setHorizon] = useState(null);
  const [thisWeekCount, setThisWeekCount] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.voiceProfile.get().catch(() => null),
      api.calendar.list?.({}).catch(() => null) || api.calendar?.list?.({}).catch(() => null),
    ]).then(([prof]) => {
      if (!mounted) return;
      const text = prof?.profile?.strategic_horizon;
      if (text && text.trim().length > 0) setHorizon(text.trim());
    });
    // Best-effort posted-this-week count. Failures are silent — the strip
    // still shows the horizon quote which is the main value.
    api.library.list().then((rows) => {
      if (!mounted || !Array.isArray(rows)) return;
      const weekStart = startOfThisWeek();
      const n = rows.filter((r) => {
        const at = r.posted_at ? new Date(r.posted_at) : null;
        return at && at >= weekStart;
      }).length;
      setThisWeekCount(n);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (!horizon) return null;

  return (
    <div className="card-pad border-primary/30 bg-gradient-to-br from-primary/8 to-transparent">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 max-w-3xl">
          <div className="text-[11px] uppercase tracking-widest text-primary">Strategic horizon · what this year is supposed to build</div>
          <blockquote className="mt-2 text-sm text-text-primary leading-relaxed border-l-2 border-primary/40 pl-3 italic">
            {horizon}
          </blockquote>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {thisWeekCount !== null && (
            <div className="text-[11px] text-text-secondary text-right">
              <span className="font-mono text-text-primary text-base">{thisWeekCount}</span> posted this week
            </div>
          )}
          <Link to="/voice-profile" className="btn-ghost text-xs whitespace-nowrap">
            Revise horizon →
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Monday 00:00 of the current week, in local time. */
function startOfThisWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}
