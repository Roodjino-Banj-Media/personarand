-- Migration 005: Bilingual content (English + French).
--
-- Roodjino's audience straddles English and French — most posts need both
-- versions available so he can pick which to publish (or publish both on
-- different platforms / at different times). Rather than duplicate the row,
-- we add nullable French columns on the same generated_content record.
--
-- Semantics:
--   body    (existing) — English version (the default / primary)
--   body_fr (new)      — French version, NULL if not generated
--   title_fr (new)     — French title, NULL if not generated
--
-- Idempotent. Safe to re-run.

ALTER TABLE generated_content
  ADD COLUMN IF NOT EXISTS body_fr TEXT,
  ADD COLUMN IF NOT EXISTS title_fr TEXT;
