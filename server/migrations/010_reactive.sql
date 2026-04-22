-- Migration 010: Reactive / opportunistic content layer.
--
-- The weekly calendar is the PLANNED arc (authority-building, framework-led).
-- Reactive content sits on top of it: unplanned commentary on something
-- happening now — a news story, a launch, a thread someone published,
-- an observation the user wants to take a position on.
--
-- Schema:
--   content_calendar.is_reactive     — true if this calendar slot is reactive
--   content_calendar.reactive_source — the seed text (URL / headline / observation)
--                                      that the reactive post is commenting on
--   generated_content.is_reactive     — mirrors for rows generated directly
--                                       (reactive posts can exist without a
--                                       calendar slot via "out of nowhere" flow)
--   generated_content.reactive_source — same context, on the content row itself
--
-- Idempotent.

ALTER TABLE content_calendar
  ADD COLUMN IF NOT EXISTS is_reactive BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS reactive_source TEXT;

ALTER TABLE generated_content
  ADD COLUMN IF NOT EXISTS is_reactive BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS reactive_source TEXT;

-- Make it easy to find reactive-only or planned-only rows.
CREATE INDEX IF NOT EXISTS idx_calendar_reactive ON content_calendar (is_reactive) WHERE is_reactive = TRUE;
CREATE INDEX IF NOT EXISTS idx_content_reactive ON generated_content (is_reactive) WHERE is_reactive = TRUE;
