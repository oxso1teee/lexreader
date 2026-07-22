-- P0-SEC-03 release-readiness промта: клиентская проверка типа/размера
-- файла (см. src/lib/file-validation.ts) — это только UX, не защита. Тот же
-- лимит нужен на уровне самого Storage bucket, иначе можно обойти проверку,
-- вызвав Storage API напрямую.

update storage.buckets
set file_size_limit = 5242880, -- 5 МБ, как в src/lib/file-validation.ts
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'word-photos';
