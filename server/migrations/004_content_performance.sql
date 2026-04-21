-- Migration 004: Performance feedback loop on generated_content.
--
-- Adds a `performance` column so the user can rate each piece of content as
-- poor / good / strong. The top-5 "strong" posts get injected into every
-- Opus generation as tonal reference, turning the tool from a one-shot
-- generator into a compound-learning system that writes more like you
-- every week.
--
-- Idempotent — safe to run more than once. Run in Supabase SQL editor or
-- via the migration script; also safe to re-run if the column already exists.

ALTER TABLE generated_content
  ADD COLUMN IF NOT EXISTS performance TEXT
    CHECK (performance IS NULL OR performance IN ('poor', 'good', 'strong'));

-- Index on (performance, created_at DESC) so "top strong, newest first" is a
-- cheap index scan once we have a handful of rated posts.
CREATE INDEX IF NOT EXISTS idx_generated_content_performance_created
  ON generated_content (performance, created_at DESC)
  WHERE performance IS NOT NULL;
