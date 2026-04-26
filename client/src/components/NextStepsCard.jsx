import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './../lib/api.js';

/**
 * Next Steps card — adaptive Dashboard widget.
 *
 * Looks at voice profile state, KB content, calendar planning, and
 * posted-rate to propose the SINGLE most impactful next action plus
 * a couple of secondary actions. The list reorders as the user
 * completes things, so the top item is always the next-best move.
 *
 * Why this exists: a new user landing on the dashboard sees a lot of
 * cards reporting state. They don't see what to DO. This card answers
 * that one question: what's the highest-leverage thing right now?
 *
 * Hides entirely once everything reaches "good enough" thresholds —
 * we don't want a permanent prescriptive nag for users who are
 * already running.
 */

const TARGETS = {
  profile_score: 60,    // local heuristic threshold for "serviceable" voice
  kb_active: 4,          // matches AICalibrationCard's KB target
  posted_this_week: 2,   // baseline cadence target
  strong_rated: 5,       // matches AICalibrationCard's strong target
};

export default function NextStepsCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.voiceProfile.get().catch(() => null),
      api.knowledge.list().catch(() => ({ entries: [] })),
      api.calendar.list({}).catch(() => []),
      api.library.list().catch(() => []),
    ]).then(([prof, kb, cal, lib]) => {
      if (!mounted) return;
      const profileScore = prof?.cached_score?.total ?? prof?.local_score?.total ?? 0;
      const profileEmpty = !prof?.profile?.core_thesis;
      const kbActive = (kb.entries || []).filter((e) => e.is_active).length;
      const calCount = Array.isArray(cal) ? cal.length : (cal?.items?.length || 0);
      const planned = Array.isArray(cal)
        ? cal.filter((c) => c.status === 'planned').length
        : 0;
      const weekStart = startOfWeek();
      const postedThisWeek = (Array.isArray(lib) ? lib : [])
        .filter((r) => r.posted_at && new Date(r.posted_at) >= weekStart)
        .length;
      const strongRated = (Array.isArray(lib) ? lib : [])
        .filter((r) => r.performance === 'strong')
        .length;
      const unratedPosted = (Array.isArray(lib) ? lib : [])
        .filter((r) => r.status === 'posted' && !r.performance)
        .length;
      setData({ profileScore, profileEmpty, kbActive, calCount, planned, postedThisWeek, strongRated, unratedPosted });
    });
    return () => { mounted = false; };
  }, []);

  if (!data) return null;

  const steps = [];

  // 1. Voice profile — most foundational. If missing or thin, this is
  //    always the top action.
  if (data.profileEmpty) {
    steps.push({
      key: 'profile-cold',
      label: 'Build your voice profile',
      hint: 'The AI is running on the cold-start default voice. Pick an archetype to get to 60% in two clicks.',
      href: '/voice-profile',
      cta: 'Start →',
      severity: 'critical',
      sortKey: 1,
    });
  } else if (data.profileScore < TARGETS.profile_score) {
    steps.push({
      key: 'profile-thin',
      label: `Sharpen voice profile (${data.profileScore}%)`,
      hint: `Currently below the ${TARGETS.profile_score}% threshold for distinctive output. The weakest dimensions are flagged on the profile page.`,
      href: '/voice-profile',
      cta: 'Sharpen →',
      severity: 'warning',
      sortKey: 2,
    });
  }

  // 2. KB seeding — second-most foundational. Active KB entries inject
  //    into every generation.
  if (data.kbActive < TARGETS.kb_active) {
    steps.push({
      key: 'kb-thin',
      label: `Seed knowledge base (${data.kbActive}/${TARGETS.kb_active})`,
      hint: 'Active entries inject into every generation as living context. Without them, output stays generic.',
      href: '/knowledge',
      cta: 'Add entries →',
      severity: data.kbActive === 0 ? 'warning' : 'info',
      sortKey: 3,
    });
  }

  // 3. Unrated posted — closing the feedback loop.
  if (data.unratedPosted > 0) {
    steps.push({
      key: 'unrated',
      label: `Rate ${data.unratedPosted} posted ${data.unratedPosted === 1 ? 'item' : 'items'}`,
      hint: 'Strong-rated posts become tonal reference for every future generation. Each unrated post is teaching signal left on the table.',
      href: '/library?sort=newest&status=posted',
      cta: 'Rate now →',
      severity: 'info',
      sortKey: 4,
    });
  }

  // 4. Cadence — produce something this week.
  if (data.postedThisWeek < TARGETS.posted_this_week) {
    steps.push({
      key: 'cadence',
      label: `Post this week (${data.postedThisWeek}/${TARGETS.posted_this_week})`,
      hint: `${data.planned > 0 ? `${data.planned} items already planned in calendar — pick one and generate.` : 'Calendar has no planned items. Plan a few before delivery pressure hits.'}`,
      href: data.planned > 0 ? '/calendar' : '/calendar',
      cta: data.planned > 0 ? 'Open calendar →' : 'Plan now →',
      severity: 'info',
      sortKey: 5,
    });
  }

  // 5. Strong-rated bank for feedback loop.
  if (data.strongRated < TARGETS.strong_rated && data.unratedPosted === 0) {
    steps.push({
      key: 'strong-bank',
      label: `Build a bank of strong references (${data.strongRated}/${TARGETS.strong_rated})`,
      hint: 'The AI uses the top 5 strong-rated posts as tonal reference on every generation. Until you have 5, that calibration signal is incomplete.',
      href: '/library?sort=newest&status=posted',
      cta: 'Open library →',
      severity: 'info',
      sortKey: 6,
    });
  }

  // Hide entirely when everything's good.
  if (steps.length === 0) return null;

  steps.sort((a, b) => a.sortKey - b.sortKey);
  const primary = steps[0];
  const secondary = steps.slice(1, 3);

  const SEV = {
    critical: { container: 'border-danger/40 bg-danger/5', text: 'text-danger' },
    warning:  { container: 'border-warning/40 bg-warning/5', text: 'text-warning' },
    info:     { container: 'border-primary/30 bg-primary/5', text: 'text-primary' },
  };
  const primaryStyle = SEV[primary.severity] || SEV.info;

  return (
    <div className={`card-pad ${primaryStyle.container} space-y-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className={`text-[11px] uppercase tracking-widest ${primaryStyle.text}`}>Next step · highest leverage right now</div>
          <div className="text-base font-semibold mt-1">{primary.label}</div>
          <div className="text-xs text-text-secondary mt-1 leading-relaxed max-w-2xl">{primary.hint}</div>
        </div>
        <Link to={primary.href} className="btn-primary text-xs whitespace-nowrap">{primary.cta}</Link>
      </div>

      {secondary.length > 0 && (
        <div className="border-t border-current/20 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {secondary.map((s) => (
            <Link
              key={s.key}
              to={s.href}
              className="rounded-md border border-border bg-card p-3 hover:border-text-secondary transition-colors"
            >
              <div className="text-xs font-semibold text-text-primary">{s.label}</div>
              <div className="text-[11px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">{s.hint}</div>
              <div className="text-[11px] text-primary mt-1.5">{s.cta}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const d = new Date(now);
  d.setDate(now.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}
