-- M3 Slice 4 §8 (undo last grade): additive, mirrors migration 0032's own
-- pattern. previous_state_json/next_state_json (0032) only capture the FSRS
-- shadow Card — legacy SM-2 fields (ease_factor/interval_days/repetitions/
-- due_at/first_reviewed_at/last_reviewed_at) are never snapshotted anywhere,
-- so undo cannot restore the scheduler that's actually authoritative for
-- due_at for non-allowlisted users without this. Populated unconditionally
-- in reviewWord() (not gated behind any FSRS flag — this is legacy state,
-- always relevant), so undo works the same way regardless of which
-- scheduler is authoritative for a given account.
alter table review_log
  add column previous_legacy_state_json jsonb,
  add column next_legacy_state_json jsonb;
