-- Migration 013: Per-post performance metrics on generated_content.
--
-- The existing performance_metrics table is platform-week aggregate
-- (followers, reach, engagement_total per platform per week). What was
-- missing: post-level numbers, so the user can see which specific
-- posts drove the platform-level reach. This is the foundation for
-- AI-driven pattern analysis ("your strong posts open with X").
--
-- The performance enum (poor / good / strong) stays — it captures
-- the user's qualitative judgment which is independent of raw numbers.
-- A post with 50k impressions but no commercial impact can still be
-- rated 'poor'; a post with 800 impressions but 3 inbound DMs can be
-- 'strong'.
--
-- Idempotent.

ALTER TABLE generated_content
  ADD COLUMN IF NOT EXISTS post_reach        INTEGER,
  ADD COLUMN IF NOT EXISTS post_impressions  INTEGER,
  ADD COLUMN IF NOT EXISTS post_likes        INTEGER,
  ADD COLUMN IF NOT EXISTS post_comments     INTEGER,
  ADD COLUMN IF NOT EXISTS post_shares       INTEGER,
  ADD COLUMN IF NOT EXISTS post_saves        INTEGER,
  ADD COLUMN IF NOT EXISTS post_clicks       INTEGER,
  ADD COLUMN IF NOT EXISTS post_metrics_at   TIMESTAMPTZ;

-- Filter posts that have metrics recorded — the dashboard "this week's
-- engagement" widget needs this in O(rows-with-metrics) not O(all rows).
CREATE INDEX IF NOT EXISTS idx_generated_content_metrics_at
  ON generated_content (post_metrics_at DESC)
  WHERE post_metrics_at IS NOT NULL;
