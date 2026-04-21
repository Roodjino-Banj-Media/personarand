const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { platform } = req.query;
    const where = platform ? 'WHERE platform = @platform' : '';
    const rows = await db.prepare(`SELECT * FROM performance_metrics ${where} ORDER BY week_start DESC, platform`).all({ platform });
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/latest', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT m.* FROM performance_metrics m
      INNER JOIN (
        SELECT platform, MAX(week_start) AS max_week
        FROM performance_metrics
        GROUP BY platform
      ) last ON last.platform = m.platform AND last.max_week = m.week_start
    `).all();
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { week_start, entries } = req.body || {};
    if (!week_start || !Array.isArray(entries)) return res.status(400).json({ error: 'week_start and entries[] are required' });

    let inserted = 0;
    for (const row of entries) {
      if (!PLATFORMS.includes(row.platform)) continue;
      await db.prepare(`
        INSERT INTO performance_metrics (week_start, platform, followers, posts_count, reach, engagement_total, top_post_link, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run([
        week_start,
        row.platform,
        row.followers ?? null,
        row.posts_count ?? null,
        row.reach ?? null,
        row.engagement_total ?? null,
        row.top_post_link ?? null,
        row.notes ?? null,
      ]);
      inserted += 1;
    }
    res.json({ ok: true, inserted });
  } catch (e) { next(e); }
});

router.get('/platforms', (req, res) => res.json(PLATFORMS));

router.get('/trends', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT week_start, platform, followers, reach, engagement_total
      FROM performance_metrics
      ORDER BY week_start ASC, platform ASC
    `).all();
    const byWeek = new Map();
    for (const r of rows) {
      const wk = r.week_start instanceof Date ? r.week_start.toISOString().slice(0, 10) : String(r.week_start).slice(0, 10);
      if (!byWeek.has(wk)) byWeek.set(wk, { week_start: wk });
      const week = byWeek.get(wk);
      week[`${r.platform}_followers`] = r.followers;
      week[`${r.platform}_reach`] = r.reach;
      week[`${r.platform}_engagement`] = r.engagement_total;
    }
    res.json([...byWeek.values()]);
  } catch (e) { next(e); }
});

router.get('/health', async (req, res, next) => {
  try {
    const db = openDb();
    const now = Date.now();
    const result = {};

    const postedRows = await db.prepare(`
      SELECT platform, MAX(updated_at) AS last_posted_at
      FROM generated_content
      WHERE status = 'posted' AND platform IS NOT NULL
      GROUP BY platform
    `).all();
    const lastPosted = new Map(postedRows.map((r) => [r.platform, r.last_posted_at]));

    const metricRows = await db.prepare(`
      SELECT platform, week_start, followers, engagement_total
      FROM performance_metrics
      ORDER BY platform ASC, week_start DESC
    `).all();
    const metricsByPlatform = new Map();
    for (const r of metricRows) {
      if (!metricsByPlatform.has(r.platform)) metricsByPlatform.set(r.platform, []);
      metricsByPlatform.get(r.platform).push(r);
    }

    for (const platform of PLATFORMS) {
      const posted = lastPosted.get(platform);
      const days = posted
        ? Math.max(0, Math.floor((now - new Date(posted).getTime()) / 86400000))
        : null;

      const recent = metricsByPlatform.get(platform) || [];
      const latest = recent[0] || null;
      const prior = recent[1] || null;
      let engagement_trend = null;
      if (latest?.engagement_total != null && prior?.engagement_total != null && prior.engagement_total > 0) {
        engagement_trend = (latest.engagement_total - prior.engagement_total) / prior.engagement_total;
      }

      // Distinguish "we have no data yet" from "user actually neglected this
      // platform". Before this, every platform went red with "neglected" on a
      // fresh install — pure alarm fatigue. The only real neglect signals are:
      //   (a) user posted here before, but hasn't in 14+ days, OR
      //   (b) engagement is tanking week-over-week
      // If we have neither history nor metrics, report 'unknown' so the UI can
      // show a neutral "not tracked yet" state instead of a red panel.
      const hasHistory = posted !== undefined || recent.length > 0;
      let status;
      if (!hasHistory) {
        status = 'unknown';
      } else if (days !== null && days > 14) {
        status = 'neglected';
      } else if (days !== null && days > 7) {
        status = 'declining';
      } else if (engagement_trend !== null && engagement_trend < -0.10) {
        status = 'declining';
      } else {
        status = 'healthy';
      }

      result[platform] = {
        status,
        days_since_last_posted: days,
        engagement_trend,
        latest_followers: latest?.followers ?? null,
        latest_week: latest?.week_start ?? null,
      };
    }

    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
