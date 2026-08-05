-- M3 Slice 3: account-synced reader settings (docs/ui/m3-slice3-library-reader-plan.md §8).
-- Additive, backward-compatible: default '{}' means every existing row is
-- unaffected; the client falls back to localStorage defaults for any key
-- absent from the JSON, so a partially-filled or empty value is always safe.
alter table profiles
  add column reader_settings jsonb not null default '{}'::jsonb;
