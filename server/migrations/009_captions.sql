-- Migration 009: Post captions for carousels and videos.
--
-- A video row's `body` is the SCRIPT (what gets spoken/filmed). A carousel
-- row's `body` is the slide structure (what appears on each slide). Neither
-- is the CAPTION — the text that goes above the media when you publish on
-- LinkedIn, Instagram, TikTok, etc.
--
-- This migration adds dedicated caption columns so captions can be generated,
-- edited, and copied independently of the media content they describe.
--
-- Idempotent.

ALTER TABLE generated_content
  ADD COLUMN IF NOT EXISTS caption_en TEXT,
  ADD COLUMN IF NOT EXISTS caption_fr TEXT;
