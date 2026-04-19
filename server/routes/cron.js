const express = require('express');
const { runDueIssues, runWelcomeSequence } = require('../lib/scheduler');

const router = express.Router();

// Called by GitHub Actions every 15 min. Protected by CRON_SECRET.
router.post('/run-due-jobs', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Invalid cron secret' });
  }
  try {
    const issues = await runDueIssues();
    const welcome = await runWelcomeSequence();
    res.json({ ok: true, issues, welcome, at: new Date().toISOString() });
  } catch (err) {
    console.error('[cron]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
