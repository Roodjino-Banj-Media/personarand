const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare('SELECT * FROM weekly_reviews ORDER BY week_start DESC').all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:week_start', async (req, res, next) => {
  try {
    const db = openDb();
    const row = await db.prepare('SELECT * FROM weekly_reviews WHERE week_start = ?').get([req.params.week_start]);
    res.json(row || { week_start: req.params.week_start, what_worked: '', what_didnt: '', next_focus: '' });
  } catch (e) { next(e); }
});

router.put('/:week_start', async (req, res, next) => {
  try {
    const db = openDb();
    const { what_worked = '', what_didnt = '', next_focus = '' } = req.body || {};
    await db.prepare(`
      INSERT INTO weekly_reviews (week_start, what_worked, what_didnt, next_focus)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (week_start) DO UPDATE SET
        what_worked = EXCLUDED.what_worked,
        what_didnt = EXCLUDED.what_didnt,
        next_focus = EXCLUDED.next_focus,
        updated_at = CURRENT_TIMESTAMP
    `).run([req.params.week_start, what_worked, what_didnt, next_focus]);
    const row = await db.prepare('SELECT * FROM weekly_reviews WHERE week_start = ?').get([req.params.week_start]);
    res.json(row);
  } catch (e) { next(e); }
});

router.get('/:week_start/summary', async (req, res, next) => {
  try {
    const db = openDb();
    const week = req.params.week_start;
    const weekEnd = addDays(week, 7);

    const posted = await db.prepare(`
      SELECT gc.id, gc.platform, gc.content_type, gc.title, gc.body, gc.updated_at, gc.performance_notes,
             cc.funnel_layer, cc.week AS calendar_week
      FROM generated_content gc
      LEFT JOIN content_calendar cc ON cc.id = gc.calendar_id
      WHERE gc.status = 'posted' AND gc.updated_at >= ? AND gc.updated_at < ?
      ORDER BY gc.updated_at DESC
    `).all([week, weekEnd]);

    const outcomes = await db.prepare(`
      SELECT * FROM commercial_outcomes
      WHERE date >= ? AND date < ?
      ORDER BY date DESC, id DESC
    `).all([week, weekEnd]);

    const currentMetrics = await db.prepare(`
      SELECT platform, followers, reach, engagement_total, posts_count
      FROM performance_metrics WHERE week_start = ?
    `).all([week]);

    const prior = await db.prepare(`
      SELECT week_start FROM performance_metrics
      WHERE week_start < ? ORDER BY week_start DESC LIMIT 1
    `).get([week]);

    const priorMetrics = prior ? await db.prepare(`
      SELECT platform, followers, reach, engagement_total
      FROM performance_metrics WHERE week_start = ?
    `).all([prior.week_start]) : [];

    const priorByPlatform = new Map(priorMetrics.map((r) => [r.platform, r]));
    const deltas = PLATFORMS.map((platform) => {
      const cur = currentMetrics.find((m) => m.platform === platform);
      const pri = priorByPlatform.get(platform);
      const delta = (cur && pri && cur.followers != null && pri.followers != null)
        ? cur.followers - pri.followers : null;
      return {
        platform,
        followers: cur?.followers ?? null,
        followers_delta: delta,
        posts_count: cur?.posts_count ?? null,
        engagement_total: cur?.engagement_total ?? null,
        reach: cur?.reach ?? null,
      };
    });

    const review = await db.prepare('SELECT * FROM weekly_reviews WHERE week_start = ?').get([week]) ||
      { week_start: week, what_worked: '', what_didnt: '', next_focus: '' };

    const outcomeCounts = outcomes.reduce((acc, o) => {
      acc[o.outcome_type] = (acc[o.outcome_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      week_start: week,
      week_end: weekEnd,
      prior_week_start: prior?.week_start || null,
      review,
      posted,
      outcomes,
      outcome_counts: outcomeCounts,
      platform_deltas: deltas,
      posted_by_funnel: posted.reduce((acc, p) => {
        const layer = p.funnel_layer || 'Unclassified';
        acc[layer] = (acc[layer] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (e) { next(e); }
});

module.exports = router;
