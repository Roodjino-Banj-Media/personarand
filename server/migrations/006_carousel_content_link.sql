-- Migration 006: Cross-link carousel_designs ↔ generated_content
--
-- Before this, carousels were silent islands — you could generate a carousel
-- from the Carousel Studio and it never appeared in the Library (so no rating,
-- no feedback loop). And if you generated a carousel via the calendar's
-- GenerateModal, it landed in generated_content but never became an editable
-- carousel in the Studio. Two entry points, two siloed tables, no bridge.
--
-- After: every carousel is represented in BOTH tables. carousel_designs.content_id
-- points back to the matching generated_content row. Library shows the carousel,
-- Studio shows the carousel, both stay in sync.
--
-- Idempotent. Safe to re-run.

ALTER TABLE carousel_designs
  ADD COLUMN IF NOT EXISTS content_id BIGINT REFERENCES generated_content(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carousel_designs_content_id
  ON carousel_designs (content_id)
  WHERE content_id IS NOT NULL;
