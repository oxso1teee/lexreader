-- M3 Slice 3: persistent import processing status (docs/ui/m3-slice3-library-reader-plan.md §8).
-- Additive, backward-compatible: default 'ready' means every existing row
-- is unaffected, no backfill needed. texts imported before this migration
-- are treated as already-ready, which matches reality (they finished
-- importing synchronously before this column existed).
alter table texts
  add column processing_status text not null default 'ready'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column processing_stage text,
  add column processing_error text,
  add column processing_started_at timestamptz,
  add column processing_completed_at timestamptz;
