-- M3 Slice 12: adds transcript provenance + duration to texts (both nullable,
-- additive — every existing row is unaffected, no backfill needed, matching
-- the same "additive, backward-compatible" pattern as migration 0033), plus
-- a DB-level dedup guarantee for per-user YouTube re-imports. See
-- docs/ui/m3-slice12-production-architecture.md §9/§16 for full rationale.

alter table texts
  add column youtube_duration_seconds integer,
  add column transcript_source text
    check (
      transcript_source is null
      or transcript_source in (
        'manual_caption', 'auto_caption', 'innertube',
        'browser_bridge', 'yt_dlp_caption', 'speech_to_text'
      )
    );

-- Run the pre-flight duplicate check (see docs/ui/m3-slice12-production-architecture.md
-- §16, or the standalone pre-flight query provided alongside this migration)
-- against the target database before applying this index — it will fail to
-- create if any existing (owner_id, youtube_video_id) pair is already
-- duplicated.
create unique index texts_owner_youtube_video_uidx
  on texts (owner_id, youtube_video_id)
  where youtube_video_id is not null and owner_id is not null;
