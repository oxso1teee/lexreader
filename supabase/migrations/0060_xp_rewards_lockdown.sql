-- Phase 2, итерация 6 — XP, награды и ежедневные цели. ЧАСТЬ 2 из 2: CONTRACT.
--
-- Завершает выкладку и закрывает прямую запись наград клиентской ролью. НЕСОВМЕСТИМА со старым
-- приложением (до итерации 6): старый addXp пишет profiles.xp и activity_days пользовательской
-- ролью, старый код вставляет достижения и пишет xp_boost_until / отметку сундука. После этой
-- миграции такие запросы отклоняются (SQLSTATE 42501).
--
-- ПРИМЕНЯТЬ ТОЛЬКО ПОСЛЕ ТОГО, как:
--   1. применена 0059 (expand);
--   2. новое приложение задеплоено и работает на всех инстансах (старых не осталось, в том числе
--      закреплённых защитой от рассинхронизации версий Vercel — проверьте окно её действия);
--   3. проверена совместимость: главный экран, награды, урок и повторение работают.
--
-- Что делает, строго в ОДНОЙ транзакции (весь блок — один оператор DO, поэтому атомарность не
-- зависит от того, как раннер миграций оборачивает файл):
--   1. finish_rewards_rollout(): блокирует запись profiles и activity_days (чтение не блокируется),
--      переносит XP, накопленный новым кодом в фазе overlap, в profiles.xp / activity_days.xp,
--      выставляет цели дня, ставит applied = true и переводит фазу в live. Таймаут ожидания
--      блокировок — 10 секунд: при неудаче откатывается ВСЯ миграция, её можно запустить снова;
--   2. запрещает клиентской роли писать награды и производные от активности поля профиля
--      (profiles.xp, xp_boost_until, отметка сундука, timezone_changed_at; серия и заморозка:
--      streak_current, streak_longest, last_active_date, streak_freeze_available, streak_freeze_week,
--      streak_before_break, streak_repair_until; review_best_session_count, perfect_week_awarded_week;
--      duel_win_streak — серия побед в дуэлях, её меняет только claim_duel_result())
--      и таблицы activity_days, user_achievements;
--   3. включает новые типы ежедневных заданий (check на quest_type) — старого интерфейса уже нет.
-- Пока старое приложение живо, пунктов 2–3 быть не должно: см. барьер выкладки в 0059.
--
-- Клиентскую роль не затрагивает ничего, что пишет текущий код нового приложения: цель дня,
-- часовой пояс (с антидребезгом из 0059), онбординг-профиль без наград и серий. Серию, заморозку,
-- рекорд сессии и отметку идеальной недели новое приложение пишет сервисной ролью (touchStreak,
-- updateReviewBest, awardPerfectWeekIfEligible, сундук) — по реальным событиям, а не по значению от клиента.
-- Откат — внизу (закомментирован, не выполняется).

-- Защита от ошибки порядка: без 0059 закрывать нечего, а новый код не работал бы.
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname in ('award_xp', 'mark_goal_met', 'finish_rewards_rollout') group by n.nspname having count(*) = 3)
     or not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'rollout_state')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'profiles' and column_name = 'timezone_changed_at') then
    raise exception using errcode = '55000', message = 'apply 0059 (expand) first: award_xp / mark_goal_met / finish_rewards_rollout / rollout_state / profiles.timezone_changed_at are missing';
  end if;
end $$;

-- ---------- награды профиля: функция-страж ----------
--
-- profiles доступна владельцу на запись целиком (0001), поэтому без защиты любой клиент через
-- PostgREST мог бы выставить себе XP, вечный Double-XP (xp_boost_until), отметку «сундук открыт»,
-- обойти антидребезг пояса, сбросив timezone_changed_at, — и «нарисовать» серию: streak_current /
-- streak_longest (от них зависят достижения, друзья-серии, лидерборд), бесконечные заморозки
-- (streak_freeze_available + streak_freeze_week), бесплатное восстановление серии
-- (streak_before_break + streak_repair_until), рекорд сессии и отметку идеальной недели, а также серию
-- побед в дуэлях duel_win_streak (её единственный законный писатель — claim_duel_result(): security
-- definer, выполняется от владельца функции, поэтому триггер её не задевает).
-- Эти поля меняет только сервер: award_xp() (security definer — выполняется от владельца функции)
-- и сервисная роль, на которой работают touchStreak, сундук и награды недели.
-- Остальные поля профиля (цель дня, пояс, настройки, streak_goal_days…) пользователь по-прежнему меняет сам.
-- (Сама функция ничего не запрещает, пока к таблице не подключён триггер — это делает блок ниже.)

create or replace function public.profiles_guard_rewards()
returns trigger
language plpgsql
as $$
begin
  -- current_user — роль, ВЫПОЛНЯЮЩАЯ запрос: PostgREST ставит authenticated/anon,
  -- а award_xp() выполняется от имени владельца функции.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- профиль создаётся с начальными значениями; награды и серия — только сервером
    if new.xp <> 0 or new.xp_boost_until is not null or new.daily_quest_chest_claimed_date is not null
       or new.timezone_changed_at is not null
       or new.streak_current <> 0 or new.streak_longest <> 0 or new.last_active_date is not null
       or new.streak_freeze_available is distinct from true or new.streak_freeze_week is not null
       or new.streak_before_break is not null or new.streak_repair_until is not null
       or new.review_best_session_count <> 0 or new.perfect_week_awarded_week is not null
       or new.duel_win_streak <> 0 then
      raise exception using errcode = '42501', message = 'profile rewards are managed by the server';
    end if;
  elsif new.xp is distinct from old.xp
     or new.xp_boost_until is distinct from old.xp_boost_until
     or new.daily_quest_chest_claimed_date is distinct from old.daily_quest_chest_claimed_date
     or new.timezone_changed_at is distinct from old.timezone_changed_at
     or new.streak_current is distinct from old.streak_current
     or new.streak_longest is distinct from old.streak_longest
     or new.last_active_date is distinct from old.last_active_date
     or new.streak_freeze_available is distinct from old.streak_freeze_available
     or new.streak_freeze_week is distinct from old.streak_freeze_week
     or new.streak_before_break is distinct from old.streak_before_break
     or new.streak_repair_until is distinct from old.streak_repair_until
     or new.review_best_session_count is distinct from old.review_best_session_count
     or new.perfect_week_awarded_week is distinct from old.perfect_week_awarded_week
     or new.duel_win_streak is distinct from old.duel_win_streak then
    raise exception using errcode = '42501', message = 'profile rewards are managed by the server';
  end if;
  return new;
end;
$$;

-- ---------- переход: перенос накопленного + запреты — одним оператором ----------

do $contract$
begin
  -- 1. перенос и фаза live (берёт блокировки записи profiles / activity_days до конца транзакции)
  perform public.finish_rewards_rollout();

  -- 2a. награды и серия в профиле
  create trigger profiles_guard_rewards
    before insert or update of xp, xp_boost_until, daily_quest_chest_claimed_date, timezone_changed_at,
      streak_current, streak_longest, last_active_date, streak_freeze_available, streak_freeze_week,
      streak_before_break, streak_repair_until, review_best_session_count, perfect_week_awarded_week, duel_win_streak on profiles
    for each row execute function public.profiles_guard_rewards();

  -- 2b. activity_days: запись только сервером.
  -- goal_met и xp в activity_days питают идеальную неделю (+20 XP), достижения, неделю серии и цель
  -- дня. Раньше политика «owner full access» позволяла владельцу вписать любые значения запросом из
  -- браузера. Теперь клиент только читает свои строки; пишут award_xp(), mark_goal_met() и
  -- сервисная роль (отметка заморозки в streak.ts).
  drop policy if exists "activity_days: owner full access" on activity_days;
  create policy "activity_days: owner can read" on activity_days
    for select using (user_id = auth.uid());
  revoke insert, update, delete on activity_days from authenticated;

  -- 2c. user_achievements: достижения выдаёт только сервер по реальным условиям
  -- (src/lib/achievements-award.ts). Раньше политика позволяла владельцу вставить любую строку.
  drop policy if exists "user_achievements: owner insert" on user_achievements;
  revoke insert on user_achievements from authenticated;

  -- 3. новые типы ежедневных заданий: старого интерфейса, который их не отобразит, уже нет
  alter table daily_quests drop constraint if exists daily_quests_quest_type_check;
  alter table daily_quests add constraint daily_quests_quest_type_check check (
    quest_type in ('read_minutes', 'review_words', 'combo_streak', 'earn_xp', 'complete_lessons', 'answer_exercises')
  );
end
$contract$;

-- Откат (не выполняется). Возвращает прежние права — нужен, только если надо вернуть старое
-- приложение. Фаза остаётся live: перенесённый XP уже в счётчиках, и старое приложение продолжит с них.
--
-- alter table daily_quests drop constraint if exists daily_quests_quest_type_check;
-- alter table daily_quests add constraint daily_quests_quest_type_check
--   check (quest_type in ('read_minutes', 'review_words', 'combo_streak'));   -- после удаления строк новых типов
-- create policy "user_achievements: owner insert" on user_achievements
--   for insert with check (owner_id = auth.uid());
-- grant insert on user_achievements to authenticated;
-- drop policy if exists "activity_days: owner can read" on activity_days;
-- create policy "activity_days: owner full access" on activity_days
--   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- grant insert, update, delete on activity_days to authenticated;
-- drop trigger if exists profiles_guard_rewards on profiles;
-- drop function if exists public.profiles_guard_rewards();
