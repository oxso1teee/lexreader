-- Найдено при повторном аудите RLS: бакет word-photos был публичным (both
-- bucket.public=true И select-политика "using (bucket_id = 'word-photos')"
-- без всякого ограничения по владельцу/роли) — ЛЮБОЙ, включая
-- неавторизованных, мог перечислить (list) все папки/файлы бакета и скачать
-- чужие фото к словам напрямую по публичному URL. Делаем бакет приватным и
-- ограничиваем чтение владельцем — фото теперь отдаются только через
-- подписанные (signed) URL с ограниченным сроком жизни, генерируемые
-- сервером (см. src/app/(app)/notebook/page.tsx).

update storage.buckets set public = false where id = 'word-photos';

drop policy if exists "word-photos: anyone read" on storage.objects;

create policy "word-photos: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'word-photos' and (storage.foldername(name))[1] = auth.uid()::text);
