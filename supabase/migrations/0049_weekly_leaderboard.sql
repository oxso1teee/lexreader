-- docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
-- "Соревновательность — недельная лига/лидерборд среди пользователей".
--
-- Живая проверка (streak.ts, brain-stats.ts, missions/persist.ts): streak
-- уже считается (profiles.streak_current/streak_longest), недельные
-- повторения/слова/миссии уже считаются live-запросами (getReviewsThisWeekCount,
-- getMissionsCompletedThisWeek) — ни отдельного "очков за неделю" счётчика,
-- ни какой-либо межпользовательской видимости в проекте до сих пор не было
-- вообще (каждая RLS-политика в проекте — "id/owner_id = auth.uid()", ни
-- одной с межпользовательским чтением). Эта миграция — первая, где это
-- нужно по-настоящему: агрегированный лидерборд обязан быть
-- межпользовательским чтением, но только тем, что человек сам разрешил.
--
-- === Приватность — не опция, а требование (условие задачи) ===
--   1. Только явный opt-in (leaderboard_opt_in, default false) — НЕ
--      participation-by-default. Пользователь должен сам включить чекбокс
--      в настройках; ничья активность не публикуется молча.
--   2. Ни email, ни какое-либо "настоящее имя" никогда не возвращаются —
--      в profiles нет поля имени вообще (тот же факт, что уже
--      зафиксирован в src/lib/avatar-initials.ts: "единственный честный
--      источник для инициалов это email... не выдумываем имя") — функция
--      ниже возвращает ТОЛЬКО производные 2 буквы инициалов, вычисленные
--      прямо в SQL, реальный email никогда не покидает функцию ни в каком
--      виде, даже если её вызвать напрямую через PostgREST в обход
--      Next.js-кода.
--   3. Только агрегат за неделю (число повторений/слов), никогда сырые
--      строки review_log/vocabulary_items другого пользователя.
--   4. Честная пустая механика — функция никогда не подделывает
--      ботов/нулевые записи; ноль participants = пустой список, приложение
--      обязано показать честное пустое состояние (см. src/lib/leaderboard.ts).
alter table profiles add column leaderboard_opt_in boolean not null default false;

-- === Почему SECURITY DEFINER (первая в проекте) ===
-- Обычный authenticated-пользователь под RLS не может прочитать ни чужие
-- review_log/vocabulary_items/flashcards строки (везде "owner_id =
-- auth.uid()"), ни auth.users вообще (эта схема не выдаётся authenticated
-- по умолчанию) — без DEFINER агрегированный кросс-пользовательский
-- лидерборд физически невозможен под текущими политиками. Вся
-- "привилегированность" этой функции жёстко ограничена ТЕМ, ЧТО ИМЕННО
-- она возвращает (см. SELECT ниже — только rank/is_you/initials/счётчики),
-- а не тем, что может прочитать вызывающий: даже прямой RPC-вызов из
-- браузера в обход приложения не может получить ничего сверх этого.
--
-- search_path = '' + полная схема-квалификация каждой таблицы —
-- стандартная защита DEFINER-функций от search_path hijacking (тот же
-- принцип, что уже применён в check_translate_rate_limit,
-- 0045_atomic_translate_rate_limit.sql, хоть та и SECURITY INVOKER).
create or replace function public.get_weekly_leaderboard()
returns table (
  rank integer,
  is_you boolean,
  initials text,
  reviews_count integer,
  words_count integer,
  score integer
)
language sql
security definer
set search_path = ''
stable
as $$
  with activity as (
    select
      p.id as user_id,
      (
        select count(*)::int
        from public.review_log rl
        join public.flashcards f on f.id = rl.flashcard_id
        where f.owner_id = p.id
          and rl.reviewed_at >= date_trunc('week', now() at time zone 'utc')
      ) as reviews_count,
      (
        select count(*)::int
        from public.vocabulary_items vi
        where vi.owner_id = p.id
          and vi.created_at >= date_trunc('week', now() at time zone 'utc')
      ) as words_count
    from public.profiles p
    where p.leaderboard_opt_in = true
  ),
  -- Не показываем ноль-активити opted-in пользователей — лига про то, что
  -- реально сделано за неделю, а не про список записавшихся.
  scored as (
    select user_id, reviews_count, words_count, (reviews_count + words_count) as score
    from activity
    where reviews_count + words_count > 0
  )
  select
    (row_number() over (order by s.score desc, s.user_id))::int as rank,
    s.user_id = auth.uid() as is_you,
    upper(left(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'), 2)) as initials,
    s.reviews_count,
    s.words_count,
    s.score
  from scored s
  join auth.users u on u.id = s.user_id
  order by s.score desc, s.user_id
  limit 50;
$$;

-- authenticated only (matches every other feature in this app — login
-- required); anon explicitly excluded, no reason an unauthenticated caller
-- should ever see even the aggregated board.
revoke all on function public.get_weekly_leaderboard() from public;
revoke all on function public.get_weekly_leaderboard() from anon;
grant execute on function public.get_weekly_leaderboard() to authenticated;

-- Откат:
-- revoke all on function public.get_weekly_leaderboard() from authenticated;
-- drop function if exists public.get_weekly_leaderboard();
-- alter table profiles drop column leaderboard_opt_in;
