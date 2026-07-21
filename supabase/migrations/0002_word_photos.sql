-- Фото на карточках слов (раздел 4.4 ТЗ) — Supabase Storage bucket.
insert into storage.buckets (id, name, public)
values ('word-photos', 'word-photos', true)
on conflict (id) do nothing;

-- Путь файла: {auth.uid()}/{vocabulary_item_id}.ext — папка первого уровня
-- ограничивает загрузку/изменение/удаление только владельцем.
create policy "word-photos: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'word-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "word-photos: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'word-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "word-photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'word-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Бакет публичный (для простого photo_url без подписанных ссылок), но
-- сами вставки требуют auth.
create policy "word-photos: anyone read" on storage.objects
  for select using (bucket_id = 'word-photos');
