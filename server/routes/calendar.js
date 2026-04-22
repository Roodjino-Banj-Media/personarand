const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = openDb();
    const { week, platform, funnel_layer, status } = req.query;
    const clauses = [];
    const params = {};
    if (week) { clauses.push('cc.week = @week'); params.week = Number(week); }
    if (status) { clauses.push('cc.status = @status'); params.status = status; }
    if (funnel_layer) { clauses.push('cc.funnel_layer ILIKE @funnel_layer'); params.funnel_layer = `%${funnel_layer}%`; }
    if (platform) { clauses.push('cc.platforms::text ILIKE @platform'); params.platform = `%${platform}%`; }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    // Attach draft + posted counts so the calendar UI can show badges without
    // re-fetching the whole library for every card.
    const rows = await db.prepare(`
      SELECT cc.*,
        COALESCE((SELECT COUNT(*) FROM generated_content gc WHERE gc.calendar_id = cc.id), 0) AS content_count,
        COALESCE((SELECT COUNT(*) FROM generated_content gc WHERE gc.calendar_id = cc.id AND gc.status = 'posted'), 0) AS posted_count
      FROM content_calendar cc
      ${where}
      ORDER BY cc.week, cc.id
    `).all(params);
    res.json(rows.map(hydrate));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const item = await db.prepare('SELECT * FROM content_calendar WHERE id = ?').get([req.params.id]);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const generated = await db
      .prepare('SELECT * FROM generated_content WHERE calendar_id = ? ORDER BY created_at DESC')
      .all([req.params.id]);
    res.json({ ...hydrate(item), generated });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    const info = await db.prepare(`
      INSERT INTO content_calendar (week, day, title, description, content_type, platforms, funnel_layer, status, is_reactive, reactive_source)
      VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)
    `).run([
      b.week || 99,
      b.day || null,
      b.title || 'Untitled',
      b.description || '',
      b.content_type || 'linkedin-short',
      typeof b.platforms === 'string' ? b.platforms : JSON.stringify(Array.isArray(b.platforms) ? b.platforms : []),
      b.funnel_layer || 'Discovery',
      b.status || 'planned',
      b.is_reactive === true,
      b.reactive_source || null,
    ]);
    const row = await db.prepare(`SELECT * FROM content_calendar WHERE id = ?`).get([info.lastInsertRowid]);
    res.status(201).json(hydrate(row));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const b = req.body || {};
    const existing = await db.prepare(`SELECT * FROM content_calendar WHERE id = ?`).get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const newStatus = b.status ?? existing.status;
    await db.prepare(`
      UPDATE content_calendar SET
        week = ?, day = ?, title = ?, description = ?, content_type = ?, platforms = ?::jsonb, funnel_layer = ?, status = ?
      WHERE id = ?
    `).run([
      b.week ?? existing.week,
      b.day !== undefined ? b.day : existing.day,
      b.title ?? existing.title,
      b.description ?? existing.description,
      b.content_type ?? existing.content_type,
      b.platforms !== undefined ? (typeof b.platforms === 'string' ? b.platforms : JSON.stringify(b.platforms)) : JSON.stringify(existing.platforms),
      b.funnel_layer ?? existing.funnel_layer,
      newStatus,
      req.params.id,
    ]);
    if (newStatus !== existing.status) {
      await syncCalendarStatusToContent(db, req.params.id, newStatus);
    }
    const row = await db.prepare(`SELECT * FROM content_calendar WHERE id = ?`).get([req.params.id]);
    res.json(hydrate(row));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = openDb();
    const r = await db.prepare(`DELETE FROM content_calendar WHERE id = ?`).run([req.params.id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const allowed = ['planned', 'scripted', 'shot', 'edited', 'posted'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
    const db = openDb();
    const existing = await db.prepare('SELECT status FROM content_calendar WHERE id = ?').get([req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.prepare('UPDATE content_calendar SET status = ? WHERE id = ?').run([status, req.params.id]);
    if (status !== existing.status) {
      await syncCalendarStatusToContent(db, req.params.id, status);
    }
    const updated = await db.prepare('SELECT * FROM content_calendar WHERE id = ?').get([req.params.id]);
    res.json(hydrate(updated));
  } catch (e) { next(e); }
});

/**
 * Calendar → Content status sync.
 * Keeps linked generated_content rows in step when a calendar item's
 * production stage advances. The status vocabularies differ, so we only
 * sync the transitions where the mapping is obvious:
 *
 *   calendar 'posted' → content 'posted' (for rows in draft or scheduled)
 *   calendar 'edited' → content 'scheduled' (for rows still in draft)
 *
 * Other transitions (planned / scripted / shot) leave content alone —
 * we don't regress content status, and those stages don't imply publish-
 * readiness. Archived content is never touched by a calendar change.
 */
async function syncCalendarStatusToContent(db, calendarId, calendarStatus) {
  try {
    if (calendarStatus === 'posted') {
      await db.prepare(`
        UPDATE generated_content
        SET status = 'posted', updated_at = CURRENT_TIMESTAMP,
            posted_at = COALESCE(posted_at, CURRENT_TIMESTAMP)
        WHERE calendar_id = ? AND status IN ('draft', 'scheduled')
      `).run([calendarId]);
    } else if (calendarStatus === 'edited') {
      await db.prepare(`
        UPDATE generated_content
        SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP
        WHERE calendar_id = ? AND status = 'draft'
      `).run([calendarId]);
    }
  } catch (err) {
    // Non-fatal: the calendar update itself succeeded; sync is best-effort.
    console.warn('[calendar] content sync failed:', err.message);
  }
}

function hydrate(row) {
  if (!row) return row;
  return { ...row, platforms: normalizeArray(row.platforms) };
}

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

module.exports = router;
