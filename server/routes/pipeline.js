const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

const STAGES = ['prospecting', 'contacted', 'responded', 'meeting_booked', 'meeting_done', 'proposal', 'negotiation', 'client', 'dead'];

router.get('/overview', async (req, res, next) => {
  try {
    const db = openDb();
    const byStage = await db.prepare(`
      SELECT stage, COUNT(*) AS n, COALESCE(SUM(deal_value), 0) AS total_value
      FROM prospects GROUP BY stage
    `).all();
    const stageMap = Object.fromEntries(STAGES.map((s) => [s, { count: 0, total_value: 0 }]));
    for (const r of byStage) stageMap[r.stage] = { count: Number(r.n), total_value: Number(r.total_value) };
    const pipelineValue = STAGES
      .filter((s) => !['client', 'dead'].includes(s))
      .reduce((sum, s) => sum + (stageMap[s].total_value || 0), 0);
    const closedValue = stageMap.client.total_value || 0;
    res.json({ stages: stageMap, pipeline_value: pipelineValue, closed_value: closedValue });
  } catch (e) { next(e); }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const db = openDb();
    const contacted = Number((await db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE stage IN ('contacted','responded','meeting_booked','meeting_done','proposal','negotiation','client')`).get()).n);
    const responded = Number((await db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE stage IN ('responded','meeting_booked','meeting_done','proposal','negotiation','client')`).get()).n);
    const booked = Number((await db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE stage IN ('meeting_booked','meeting_done','proposal','negotiation','client')`).get()).n);
    const proposal = Number((await db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE stage IN ('proposal','negotiation','client')`).get()).n);
    const closed = Number((await db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE stage = 'client'`).get()).n);
    const rate = (a, b) => b > 0 ? +(a / b * 100).toFixed(1) : null;
    res.json({
      contacted_to_responded: rate(responded, contacted),
      responded_to_meeting: rate(booked, responded),
      meeting_to_proposal: rate(proposal, booked),
      proposal_to_client: rate(closed, proposal),
      totals: { contacted, responded, booked, proposal, closed },
    });
  } catch (e) { next(e); }
});

router.get('/board', async (req, res, next) => {
  try {
    const db = openDb();
    const rows = await db.prepare(`
      SELECT id, name, company, stage, deal_value, next_action, last_contact, updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 AS days_in_stage
      FROM prospects
      WHERE stage NOT IN ('dead')
      ORDER BY updated_at DESC
    `).all();
    const board = Object.fromEntries(STAGES.filter((s) => s !== 'dead').map((s) => [s, []]));
    for (const r of rows) if (board[r.stage]) board[r.stage].push(r);
    res.json(board);
  } catch (e) { next(e); }
});

module.exports = router;
