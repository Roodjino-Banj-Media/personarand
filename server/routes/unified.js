const express = require('express');
const { openDb } = require('../db');

const router = express.Router();

router.get('/scorecard', async (req, res, next) => {
  try {
    const db = openDb();
    const contentThisWeek = Number((await db.prepare(`SELECT COUNT(*) AS n FROM generated_content WHERE created_at >= NOW() - INTERVAL '7 days'`).get()).n);
    const postedThisWeek = Number((await db.prepare(`SELECT COUNT(*) AS n FROM generated_content WHERE status = 'posted' AND updated_at >= NOW() - INTERVAL '7 days'`).get()).n);
    const newslettersSent = await db.prepare(`
      SELECT COUNT(*) AS n, AVG(CASE WHEN total_sent > 0 THEN CAST(total_opens AS NUMERIC)/total_sent ELSE 0 END) AS avg_open
      FROM newsletter_issues WHERE sent_at >= NOW() - INTERVAL '7 days'
    `).get();
    const emailsSent = Number((await db.prepare(`SELECT COUNT(*) AS n FROM email_outreach WHERE sent_at >= NOW() - INTERVAL '7 days'`).get()).n);
    const meetingsDone = Number((await db.prepare(`SELECT COUNT(*) AS n FROM meetings WHERE completed_at >= NOW() - INTERVAL '7 days'`).get()).n);
    const proposalsSent = Number((await db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE stage = 'proposal' AND updated_at >= NOW() - INTERVAL '7 days'`).get()).n);
    const closedDeals = await db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(deal_value), 0) AS value
      FROM prospects WHERE stage = 'client' AND updated_at >= NOW() - INTERVAL '7 days'
    `).get();
    const newSubs = Number((await db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE subscribed_at >= NOW() - INTERVAL '7 days' AND status = 'active'`).get()).n);
    const pipelineValue = Number((await db.prepare(`
      SELECT COALESCE(SUM(deal_value), 0) AS v
      FROM prospects WHERE stage IN ('proposal', 'negotiation', 'meeting_booked', 'meeting_done', 'responded')
    `).get()).v);

    res.json({
      content_created: contentThisWeek,
      content_posted: postedThisWeek,
      newsletters_sent: Number(newslettersSent.n),
      newsletter_avg_open: newslettersSent.avg_open ? +(Number(newslettersSent.avg_open) * 100).toFixed(1) : null,
      emails_sent: emailsSent,
      meetings_completed: meetingsDone,
      proposals_sent: proposalsSent,
      deals_closed: Number(closedDeals.n),
      deals_value: Number(closedDeals.value),
      new_subscribers: newSubs,
      pipeline_value: pipelineValue,
    });
  } catch (e) { next(e); }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const db = openDb();
    const hotUnlinked = Number((await db.prepare(`
      SELECT COUNT(*) AS n FROM newsletter_subscribers s
      LEFT JOIN prospect_subscriber_link psl ON psl.subscriber_id = s.id
      WHERE psl.prospect_id IS NULL AND s.status = 'active'
        AND (s.total_opens * 10 + s.total_clicks * 5) >= 40
    `).get()).n);

    const needsFollowup = Number((await db.prepare(`
      SELECT COUNT(*) AS n FROM prospects
      WHERE stage IN ('contacted', 'responded', 'meeting_done')
        AND (last_contact IS NULL OR EXTRACT(EPOCH FROM (NOW() - last_contact))/86400 > 5)
    `).get()).n);

    const agingProposals = Number((await db.prepare(`
      SELECT COUNT(*) AS n FROM prospects
      WHERE stage = 'proposal' AND EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 > 7
    `).get()).n);

    const activeInsights = Number((await db.prepare(`SELECT COUNT(*) AS n FROM insights WHERE status = 'active'`).get()).n);

    res.json({
      hot_subscribers_unlinked: hotUnlinked,
      prospects_need_followup: needsFollowup,
      aging_proposals: agingProposals,
      active_insights: activeInsights,
    });
  } catch (e) { next(e); }
});

module.exports = router;
