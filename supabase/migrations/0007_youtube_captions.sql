-- YouTube "Watch Mode": видео + синхронные субтитры с таймкодами вместо
-- склеенного текста без времени, чтобы читалку-с-видео можно было
-- синхронизировать с плеером по player.getCurrentTime().

alter table texts add column youtube_video_id text;

create table caption_segments (
  id uuid primary key default gen_random_uuid(),
  text_id uuid not null references texts(id) on delete cascade,
  start_ms int not null,
  end_ms int not null,
  body text not null,
  segment_index int not null
);

create index caption_segments_text_idx on caption_segments (text_id, segment_index);

alter table caption_segments enable row level security;

create policy "caption_segments: read via owning text" on caption_segments
  for select using (
    exists (
      select 1 from texts t where t.id = caption_segments.text_id
        and (t.owner_id = auth.uid() or t.owner_id is null)
    )
  );

create policy "caption_segments: insert via owning text" on caption_segments
  for insert with check (
    exists (
      select 1 from texts t where t.id = caption_segments.text_id
        and t.owner_id = auth.uid()
    )
  );

grant select, insert on caption_segments to authenticated;
