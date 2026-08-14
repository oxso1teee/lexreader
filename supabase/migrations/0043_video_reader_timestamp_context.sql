-- M3 Slice 12 Gate #3: Video Reader needs to preserve the video timestamp a
-- word/phrase was saved from (docs/ui/m3-slice12-gate3-video-reader-plan.md).
-- Additive only, matching 0033/0042's pattern: nullable column, every
-- existing row unaffected, no backfill needed (timestamps genuinely don't
-- exist for pre-Video-Reader contexts). Widens the source_type check
-- (added in 0041) to add 'video' alongside the existing
-- 'reader' | 'manual' | 'import' values — a video-timestamped context is a
-- real fourth provenance, not a fit for any of the three.

alter table vocabulary_contexts
  add column source_timestamp_ms integer;

alter table vocabulary_contexts
  drop constraint vocabulary_contexts_source_type_check;

alter table vocabulary_contexts
  add constraint vocabulary_contexts_source_type_check
    check (source_type in ('reader', 'manual', 'import', 'video'));

-- Rollback (not executed):
-- alter table vocabulary_contexts drop constraint vocabulary_contexts_source_type_check;
-- alter table vocabulary_contexts add constraint vocabulary_contexts_source_type_check
--   check (source_type in ('reader', 'manual', 'import'));
-- alter table vocabulary_contexts drop column source_timestamp_ms;
