-- M3 Slice 12: repair Preview schema drift and make browser-bridge persistence
-- owner-scoped, atomic, and safe to retry. The IF NOT EXISTS clauses are
-- intentional: fresh databases already receive these columns from 0033,
-- while the shared Preview database had later YouTube migrations but missed
-- the processing-state migration.

alter table public.texts
  add column if not exists processing_status text not null default 'ready',
  add column if not exists processing_stage text,
  add column if not exists processing_error text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.texts'::regclass
      and conname = 'texts_processing_status_check'
  ) then
    alter table public.texts
      add constraint texts_processing_status_check
      check (processing_status in ('pending', 'processing', 'ready', 'failed'));
  end if;
end
$$;

grant delete on table public.caption_segments to authenticated;

drop policy if exists "caption_segments: reconcile own import" on public.caption_segments;
create policy "caption_segments: reconcile own import"
  on public.caption_segments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.texts t
      where t.id = caption_segments.text_id
        and t.owner_id = (select auth.uid())
    )
  );

create or replace function public.persist_youtube_import(
  p_text_id uuid,
  p_title text,
  p_duration_seconds integer,
  p_transcript_source text,
  p_language text,
  p_word_count integer,
  p_segments jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_count integer;
  v_inserted_count integer;
  v_distinct_indexes integer;
  v_min_index integer;
  v_max_index integer;
  v_updated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if jsonb_typeof(p_segments) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'segments must be an array';
  end if;

  v_expected_count := jsonb_array_length(p_segments);
  if v_expected_count < 1 then
    raise exception using errcode = '22023', message = 'segments must not be empty';
  end if;

  if nullif(btrim(p_title), '') is null
    or nullif(btrim(p_language), '') is null
    or p_word_count < 0
    or (p_duration_seconds is not null and p_duration_seconds < 0)
  then
    raise exception using errcode = '22023', message = 'invalid transcript metadata';
  end if;

  perform 1
  from public.texts
  where id = p_text_id
    and owner_id = (select auth.uid());
  if not found then
    raise exception using errcode = '42501', message = 'text is not owned by current user';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_segments) as segment(
      start_ms integer,
      end_ms integer,
      body text,
      segment_index integer
    )
    where start_ms is null
      or start_ms < 0
      or end_ms is null
      or end_ms <= start_ms
      or nullif(btrim(body), '') is null
      or segment_index is null
      or segment_index < 0
  ) then
    raise exception using errcode = '22023', message = 'invalid caption segment';
  end if;

  select count(distinct segment_index), min(segment_index), max(segment_index)
  into v_distinct_indexes, v_min_index, v_max_index
  from jsonb_to_recordset(p_segments) as segment(segment_index integer);

  if v_distinct_indexes <> v_expected_count
    or v_min_index <> 0
    or v_max_index <> v_expected_count - 1
  then
    raise exception using errcode = '22023', message = 'segment indexes must be unique and contiguous';
  end if;

  -- DELETE + INSERT + final texts UPDATE execute in this function's single
  -- Postgres transaction. Any error rolls every statement back, preserving
  -- the last complete state and making a failed/partial retry deterministic.
  delete from public.caption_segments
  where text_id = p_text_id;

  insert into public.caption_segments (
    text_id,
    start_ms,
    end_ms,
    body,
    segment_index
  )
  select
    p_text_id,
    segment.start_ms,
    segment.end_ms,
    segment.body,
    segment.segment_index
  from jsonb_to_recordset(p_segments) as segment(
    start_ms integer,
    end_ms integer,
    body text,
    segment_index integer
  )
  order by segment.segment_index;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_expected_count then
    raise exception using errcode = 'P0001', message = 'caption count mismatch';
  end if;

  update public.texts
  set title = p_title,
      youtube_duration_seconds = p_duration_seconds,
      transcript_source = p_transcript_source,
      language = p_language,
      word_count = p_word_count,
      processing_status = 'ready',
      processing_stage = null,
      processing_error = null,
      processing_completed_at = now()
  where id = p_text_id
    and owner_id = (select auth.uid());

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception using errcode = '42501', message = 'text update was not authorized';
  end if;

  return v_inserted_count;
end
$$;

revoke all on function public.persist_youtube_import(
  uuid, text, integer, text, text, integer, jsonb
) from public;
revoke all on function public.persist_youtube_import(
  uuid, text, integer, text, text, integer, jsonb
) from anon;
grant execute on function public.persist_youtube_import(
  uuid, text, integer, text, text, integer, jsonb
) to authenticated;
