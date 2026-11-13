-- docs/moments/ROADMAP.md, этап 4 — Chapter-done. Нужен сторож "уже
-- показывали" для конкретного (пользователь, текст): finishReading()
-- вызывается на каждое закрытие читалки, а не только на первое достижение
-- 100% — без этого поля момент показывался бы повторно при каждом
-- повторном открытии уже прочитанного текста. Тот же приём, что уже есть
-- у perfect_week_awarded_week (0053) / last_rate_prompt_at (0056) — одно
-- nullable-поле-метка, не отдельная таблица.
alter table text_progress add column chapter_done_shown_at timestamptz;

-- Откат:
-- alter table text_progress drop column chapter_done_shown_at;
