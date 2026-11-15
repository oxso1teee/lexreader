-- Phase 2, итерация 6 — XP, награды и ежедневные цели. ЧАСТЬ 1 из 2: EXPAND.
--
-- Строго аддитивная миграция: всё, что нужно НОВОМУ коду приложения, и ничего, что мешало бы
-- СТАРОМУ. Текущая версия приложения (до итерации 6) продолжает работать без изменений:
-- она по-прежнему пишет profiles.xp и activity_days пользовательской ролью, вставляет
-- достижения и не знает про новые колонки и функции. Запрещающая часть — в 0060 (CONTRACT).
--
-- Порядок выкладки (expand / contract):
--   1. применить эту миграцию (0059) — база входит в фазу «overlap» (таблица rollout_state);
--   2. задеплоить новое приложение (оно начисляет награды сервером через award_xp / mark_goal_met);
--   3. убедиться, что старых инстансов приложения больше нет (в том числе закреплённых
--      «защитой от рассинхронизации версий» Vercel), и применить 0060.
--
-- БАРЬЕР ВЫКЛАДКИ (rollout_state.rewards_phase). Старое приложение обновляет счётчики XP как
-- «прочитать значение → записать значение + N» (profiles.xp, activity_days.xp, goal_met).
-- Атомарный award_xp нового приложения и такая запись на одном счётчике несовместимы: если старый
-- инстанс прочитал xp до начисления нового, а записал после, начисление теряется, и никакой
-- триггер не восстановит дельту. Поэтому пока жив хотя бы один старый инстанс:
--   • фаза «overlap» (по умолчанию после 0059): award_xp пишет ТОЛЬКО событие в xp_events с
--     applied = false — идемпотентность, дневные лимиты и Double-XP работают как обычно, а
--     profiles.xp / activity_days пишет один старый код: двух писателей одного счётчика нет;
--     mark_goal_met складывает отметку в pending_goal_marks; день в overlap — по UTC, как у
--     старого кода; смена часового пояса приостановлена (см. profiles_guard_timezone), а
--     типы заданий остаются прежними (расширение check — в 0060);
--   • 0060 вызывает finish_rewards_rollout(): под короткой блокировкой записи profiles и
--     activity_days (lock_timeout 10 с — при неудаче миграция откатывается целиком и её можно
--     повторить) переносит накопленные события в счётчики, ставит applied = true и переводит
--     фазу в «live»; дальше award_xp работает напрямую, а запись клиентом закрывается.
-- Ничего не теряется и при отказе от выкладки: неприменённые события остаются в журнале и
-- применятся при следующем finish_rewards_rollout(). Остановки сервиса нет: на время переноса
-- блокируется только запись в profiles и activity_days (миллисекунды); чтение этих таблиц не
-- блокируется, кроме мгновения DROP POLICY в 0060, которому нужно дождаться уже идущих чтений.
-- Цена: пока идёт overlap, в НОВОМ приложении сумма на профиле (profiles.xp) не растёт — она
-- догоняет в момент 0060. Ответ award_xp, цель дня и журнал наград показывают актуальные значения.
-- Держите окно коротким, но оно безопасно при любой длительности.
--
-- Что добавляется:
--  1. profiles.timezone — IANA-пояс пользователя. До этого «сегодня» везде считалось по UTC
--     (см. комментарий в 0054). NULL = UTC, поведение существующих аккаунтов не меняется.
--  2. profiles.daily_goal_type / daily_goal_target — выбранный тип дневной цели
--     (xp | lessons | exercises | reading_minutes | words). Для типа 'xp' цель по-прежнему
--     profiles.daily_xp_goal (0052) — онбординг и «цель дня» в уже написанном коде не трогаются.
--  3. xp_events — журнал начислений XP: один источник правды «за что и когда получено».
--     Уникальный (user_id, source, ref) делает начисление идемпотентным на уровне БД.
--  4. award_xp() — единственный путь начисления XP нового кода: атомарно (одна транзакция под
--     блокировкой строки профиля) проверяет идемпотентность и дневной лимит (плюс скользящий
--     лимит: за любые 24 часа не больше двух дневных лимитов), применяет Double-XP, пишет журнал,
--     profiles.xp и activity_days. goal_met ставится по ВЫБРАННОМУ типу цели (для XP — здесь).
--  5. mark_goal_met() — «цель дня выполнена» для целей не в XP (уроки, упражнения, чтение, слова).
--  6. Часовой пояс: триггер profiles_guard_timezone — только имена, известные PostgreSQL, и
--     антидребезг: смена не чаще раза в час. Первая установка пояса не ограничена и отметку не
--     ставит. Старое приложение пояс не пишет, поэтому триггер ему не мешает.
--  7. Права service_role на activity_days и user_achievements — новый код пишет туда сервером.
--  8. Индекс по завершённым попыткам уроков (0058) — для «уроков/упражнений за сегодня».
--  9. Барьер выкладки: rollout_state, rewards_phase(), pending_goal_marks, xp_events.applied и
--     finish_rewards_rollout() (вызывается из 0060).
--
-- Новые типы ежедневных заданий (check на daily_quests.quest_type) расширяются в 0060: старый
-- интерфейс не умеет отображать неизвестный тип, поэтому до ухода старых инстансов новый код
-- выдаёт только прежние типы (read_minutes, review_words, combo_streak).
--
-- Совместимость: ни одна существующая колонка и ограничение не меняются; новые колонки profiles
-- имеют default. Откат — внизу (закомментирован, не выполняется).

-- ---------- 1–2. профиль ----------

alter table profiles add column timezone text
  check (timezone is null or char_length(timezone) between 1 and 64);

-- Когда пояс менялся в последний раз (ставит триггер, клиент это поле не пишет) —
-- основа ограничения частоты смены.
alter table profiles add column timezone_changed_at timestamptz;

alter table profiles add column daily_goal_type text not null default 'xp'
  check (daily_goal_type in ('xp', 'lessons', 'exercises', 'reading_minutes', 'words'));

alter table profiles add column daily_goal_target int
  check (daily_goal_target is null or daily_goal_target > 0);

-- ---------- 3. журнал XP ----------

create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- Идентификатор источника из каталога src/lib/xp/sources.ts (lesson_complete,
  -- review_card, quest_chest…). Допустимый список — в коде: новый источник не
  -- требует миграции; здесь проверяется только форма.
  source text not null check (source ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- Ключ идемпотентности внутри источника (id попытки урока, дата сундука,
  -- понедельник недели…). NULL — событие повторяемое по природе (каждая
  -- оценка карточки), его защищает дневной лимит источника.
  ref text check (ref is null or char_length(ref) between 1 and 200),
  -- Сколько запросил источник и сколько реально начислено (с Double-XP).
  base_amount int not null check (base_amount > 0),
  amount int not null check (amount > 0),
  boosted boolean not null default false,
  -- Локальный день пользователя на момент начисления (profiles.timezone; в фазе overlap — UTC).
  day date not null,
  -- false — начисление ещё не перенесено в profiles.xp / activity_days (фаза overlap, пока жив
  -- старый код приложения); true — перенесено. Переносит finish_rewards_rollout() из 0060.
  applied boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index xp_events_idempotency_idx on xp_events (user_id, source, ref) where ref is not null;
create index xp_events_user_day_idx on xp_events (user_id, day desc);
create index xp_events_user_created_idx on xp_events (user_id, created_at desc);
-- Неприменённые события (фаза overlap): индекс почти пуст, а в live не содержит ничего.
create index xp_events_pending_idx on xp_events (user_id, day) where not applied;

alter table xp_events enable row level security;

create policy "xp_events: owner can read" on xp_events
  for select using (user_id = auth.uid());

-- Запись только через award_xp(): прямых прав на insert/update/delete нет ни у
-- одной роли приложения (на Supabase новые таблицы по умолчанию доступны ролям целиком —
-- убираем явно, а не полагаемся на отсутствие политик).
revoke all on xp_events from anon, authenticated;
grant select on xp_events to authenticated;
grant select on xp_events to service_role;

-- ---------- 3b. барьер выкладки ----------
--
-- Единственная строка: в какой фазе выкладки находятся награды. Читают только функции базы
-- (security definer) и сервис; клиентской роли доступа нет.
--   overlap — живы старые инстансы приложения: award_xp не трогает счётчики (см. заголовок);
--   live    — старых нет, счётчики пишет award_xp, клиентская запись закрыта миграцией 0060.
-- Переход overlap → live необратим и выполняется только finish_rewards_rollout().
create table rollout_state (
  id boolean primary key default true check (id),
  rewards_phase text not null default 'overlap' check (rewards_phase in ('overlap', 'live')),
  changed_at timestamptz not null default now()
);
insert into rollout_state (id) values (true);
alter table rollout_state enable row level security;
revoke all on rollout_state from anon, authenticated;
grant select on rollout_state to service_role;

-- Фаза для кода приложения и триггеров. Не секрет, поэтому доступна и клиентской роли: триггер
-- profiles_guard_timezone выполняется с правами вызывающего.
create or replace function public.rewards_phase()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- пустая таблица = самый осторожный режим (ничего не применяется напрямую)
  select coalesce((select rewards_phase from public.rollout_state), 'overlap');
$$;
revoke all on function public.rewards_phase() from public;
grant execute on function public.rewards_phase() to anon, authenticated, service_role;

-- Отметки «цель дня выполнена», сделанные новым кодом в фазе overlap. Старый код перезаписывает
-- activity_days.goal_met абсолютным значением, поэтому писать туда напрямую нельзя; отметки
-- переносятся при finish_rewards_rollout().
create table pending_goal_marks (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table pending_goal_marks enable row level security;
revoke all on pending_goal_marks from anon, authenticated;
grant select on pending_goal_marks to service_role;

-- ---------- 4. award_xp ----------

create or replace function public.award_xp(
  p_user uuid,
  p_source text,
  p_ref text,
  p_amount int,
  p_daily_cap int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
  v_deferred boolean;
  v_profile record;
  v_day date;
  v_boosted boolean;
  v_awarded int;
  v_ref text;
  v_existing record;
  v_used int;
  v_used_24h int;
  v_event_id uuid;
  v_total_before int;
  v_day_before int;
begin
  if p_user is null then
    raise exception using errcode = '22023', message = 'user_required';
  end if;
  if p_source is null or p_source !~ '^[a-z][a-z0-9_]{0,39}$' then
    raise exception using errcode = '22023', message = 'invalid_source';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception using errcode = '22023', message = 'invalid_amount';
  end if;
  if p_daily_cap is not null and p_daily_cap < 1 then
    raise exception using errcode = '22023', message = 'invalid_cap';
  end if;

  -- Порядок блокировок во всех функциях барьера один: флаг фазы → профиль → activity_days.
  -- Общая блокировка флага держится до конца транзакции: finish_rewards_rollout() (ему нужна
  -- исключительная) дожидается всех начислений в полёте, а следующие начисления видят уже live —
  -- ни одно не запишется «по старым правилам» после переноса.
  select rewards_phase into v_phase from public.rollout_state for share;
  v_deferred := coalesce(v_phase, 'overlap') <> 'live';

  -- Блокировка строки профиля сериализует ВСЕ начисления одного пользователя:
  -- два параллельных вызова выполняются друг за другом, поэтому проверка «уже начислено»
  -- и дневной лимит не гоняются сами с собой (а в live — нет потерянных обновлений
  -- profiles.xp / activity_days.xp). Сама строка в overlap не изменяется.
  select xp, daily_xp_goal, daily_goal_type, xp_boost_until, timezone
    into v_profile
    from public.profiles
   where id = p_user
   for update;
  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;

  -- День — по поясу пользователя на серверном времени; испорченное значение пояса не должно
  -- ронять начисление. В overlap — всегда UTC: так считает старый код (activity_days.day), и
  -- события применятся к тем же строкам, куда пишет он.
  if v_deferred then
    v_day := (now() at time zone 'UTC')::date;
  else
    begin
      v_day := (now() at time zone coalesce(v_profile.timezone, 'UTC'))::date;
    exception when others then
      v_day := (now() at time zone 'UTC')::date;
    end;
  end if;

  -- «{day}» в ключе заменяется днём пользователя: так «один раз за текст в день» считается
  -- атомарно и по его календарю, без отдельного запроса пояса на стороне приложения.
  v_ref := case when p_ref is null then null else replace(p_ref, '{day}', v_day::text) end;

  if v_ref is not null then
    select amount, day into v_existing
      from public.xp_events
     where user_id = p_user and source = p_source and ref = v_ref;
    if found then
      return jsonb_build_object('status', 'duplicate', 'awarded', v_existing.amount, 'day', v_existing.day);
    end if;
  end if;

  -- Лимиты считаются по всему журналу, включая ещё не применённые события.
  if p_daily_cap is not null then
    select coalesce(sum(base_amount), 0) into v_used
      from public.xp_events
     where user_id = p_user and source = p_source and day = v_day;
    if v_used + p_amount > p_daily_cap then
      return jsonb_build_object('status', 'capped', 'used', v_used, 'cap', p_daily_cap, 'day', v_day);
    end if;
    -- Скользящее окно: за любые 24 часа — не больше двух дневных лимитов. Честный
    -- пользователь упирается в него только на стыке двух локальных дней (вечером
    -- лимит, сразу после полуночи ещё лимит); а смена пояса, перекидывающая «сегодня»
    -- на другую календарную дату, дополнительных лимитов уже не даёт.
    select coalesce(sum(base_amount), 0) into v_used_24h
      from public.xp_events
     where user_id = p_user and source = p_source and created_at > now() - interval '24 hours';
    if v_used_24h + p_amount > p_daily_cap * 2 then
      return jsonb_build_object('status', 'capped', 'used', v_used_24h, 'cap', p_daily_cap * 2, 'day', v_day, 'window', 'rolling');
    end if;
  end if;

  v_boosted := v_profile.xp_boost_until is not null and v_profile.xp_boost_until > now();
  v_awarded := p_amount * case when v_boosted then 2 else 1 end;

  if v_deferred then
    -- Фаза overlap: только журнал. Счётчики не трогаем — их пишет старый код, и два писателя
    -- на одном счётчике теряют обновления. «Было» для ответа — счётчик плюс ещё не применённое.
    select v_profile.xp + coalesce(sum(amount), 0) into v_total_before
      from public.xp_events where user_id = p_user and not applied;
    select coalesce((select xp from public.activity_days where user_id = p_user and day = v_day), 0) + coalesce(sum(amount), 0)
      into v_day_before
      from public.xp_events where user_id = p_user and not applied and day = v_day;

    insert into public.xp_events (user_id, source, ref, base_amount, amount, boosted, day, applied)
    values (p_user, p_source, v_ref, p_amount, v_awarded, v_boosted, v_day, false)
    returning id into v_event_id;
  else
    insert into public.xp_events (user_id, source, ref, base_amount, amount, boosted, day)
    values (p_user, p_source, v_ref, p_amount, v_awarded, v_boosted, v_day)
    returning id into v_event_id;

    update public.profiles set xp = xp + v_awarded where id = p_user returning xp - v_awarded into v_total_before;

    -- goal_met следует выбранному типу цели: XP-цель закрывается здесь, одной транзакцией
    -- с начислением; цели «уроки / упражнения / чтение / слова» — mark_goal_met() из серверного
    -- кода. Отметка только растёт: повышение цели в середине дня уже выполненное не отменяет.
    insert into public.activity_days as ad (user_id, day, xp, goal_met)
    values (p_user, v_day, v_awarded, v_profile.daily_goal_type = 'xp' and v_awarded >= v_profile.daily_xp_goal)
    on conflict (user_id, day) do update
      set xp = ad.xp + excluded.xp,
          goal_met = ad.goal_met or (v_profile.daily_goal_type = 'xp' and (ad.xp + excluded.xp) >= v_profile.daily_xp_goal)
    returning ad.xp - v_awarded into v_day_before;
  end if;

  return jsonb_build_object(
    'status', 'awarded',
    'event_id', v_event_id,
    'awarded', v_awarded,
    'base', p_amount,
    'boosted', v_boosted,
    -- true — начисление записано в журнал, но ещё не перенесено в счётчики (фаза overlap)
    'deferred', v_deferred,
    -- Цель дня в XP для момента «цель выполнена» (collectMoments): 0, если выбранная
    -- цель дня — не XP (уроки, чтение…), чтобы XP-момент не праздновал чужую цель.
    -- (goal_met в activity_days для других типов цели ставит mark_goal_met().)
    'goal', case when v_profile.daily_goal_type = 'xp' then v_profile.daily_xp_goal else 0 end,
    'day', v_day,
    'total_before', v_total_before,
    'total_after', v_total_before + v_awarded,
    'today_before', v_day_before,
    'today_after', v_day_before + v_awarded
  );
end;
$$;

-- Вызывается только сервером (service_role) от имени пользователя из серверной
-- сессии. Прямой вызов из браузера позволил бы любому выставить себе XP.
revoke all on function public.award_xp(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, text, text, int, int) to service_role;

-- ---------- 5. mark_goal_met ----------
--
-- «Цель дня выполнена» для целей не в XP (уроки, упражнения, чтение, слова). Вызывающий
-- серверный код сам считает прогресс по фактам (src/lib/goals) и вызывает функцию, когда
-- цель достигнута. Возвращает true ровно тому вызову, который перевёл день в «выполнено» —
-- по нему показывается момент «Цель дня выполнена!» один раз; повтор и параллельный
-- вызов получают false.
create or replace function public.mark_goal_met(p_user uuid, p_day date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
  v_flipped boolean;
begin
  if p_user is null or p_day is null then
    raise exception using errcode = '22023', message = 'invalid_arguments';
  end if;
  -- Календарная дата любого пояса отличается от UTC-даты не больше чем на сутки.
  if p_day < (now() at time zone 'UTC')::date - 2 or p_day > (now() at time zone 'UTC')::date + 2 then
    raise exception using errcode = '22023', message = 'invalid_day';
  end if;

  select rewards_phase into v_phase from public.rollout_state for share;  -- порядок блокировок: флаг → профиль → activity_days
  if not exists (select 1 from public.profiles where id = p_user) then
    return false;
  end if;

  if coalesce(v_phase, 'overlap') <> 'live' then
    -- overlap: activity_days.goal_met перезаписывает старый код — отметку откладываем.
    -- Первичный ключ даёт «первому — true» и при параллельных вызовах.
    if exists (select 1 from public.activity_days where user_id = p_user and day = p_day and goal_met) then
      return false;
    end if;
    insert into public.pending_goal_marks (user_id, day) values (p_user, p_day)
    on conflict (user_id, day) do nothing
    returning true into v_flipped;
    return coalesce(v_flipped, false);
  end if;

  insert into public.activity_days as ad (user_id, day, xp, goal_met)
  values (p_user, p_day, 0, true)
  on conflict (user_id, day) do update set goal_met = true where not ad.goal_met
  returning true into v_flipped;
  return coalesce(v_flipped, false);
end;
$$;

revoke all on function public.mark_goal_met(uuid, date) from public, anon, authenticated;
grant execute on function public.mark_goal_met(uuid, date) to service_role;

-- ---------- 6. часовой пояс: допустимые имена и антидребезг ----------
--
-- Пояс определяет, когда у пользователя «меняется день» (цель, серия, задания, дневные лимиты XP).
-- Допустимы только имена, известные PostgreSQL (то же, что принимает приложение: именованные
-- IANA-пояса, не смещения «+03:00» — в PostgreSQL они читаются с обратным знаком). Смена —
-- не чаще раза в час: это защита от «дребезга» (два устройства с разными поясами, VPN), а не от
-- фарма. От фарма защищают скользящий лимит в award_xp и идемпотентные ключи по дате: в любой
-- момент на планете существует не больше трёх разных календарных дат, поэтому «прыжки» между поясами
-- дают разовый выигрыш не больше двух дневных лимитов (src/lib/timezone-policy.test.ts).
--  • Первая установка (NULL → пояс) не ограничена и отметку времени не ставит, поэтому ошибочную
--    первую синхронизацию (например, через VPN) можно сразу исправить.
--  • Отметка timezone_changed_at ставится при смене существующего пояса.
--  • Пока идёт overlap (живы старые инстансы), клиентская смена пояса приостановлена
--    (timezone_sync_paused): новый локальный день сдвинул бы last_active_date и дневные строки
--    относительно UTC-логики старого кода серии. Приложение в это время пояс не синхронизирует.
--  • Триггеры одного события срабатывают по алфавиту: profiles_guard_rewards (0060) идёт раньше
--    этого и защищает отметку от записи клиентом.

create or replace function public.profiles_guard_timezone()
returns trigger
language plpgsql
as $$
begin
  -- current_user — роль, ВЫПОЛНЯЮЩАЯ запрос: PostgREST ставит authenticated/anon.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.timezone is not distinct from old.timezone then
    return new;
  end if;
  if public.rewards_phase() <> 'live' then
    raise exception using errcode = '55000', message = 'timezone_sync_paused';
  end if;
  if new.timezone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end if;
  if old.timezone is not null then
    if old.timezone_changed_at is not null and old.timezone_changed_at > now() - interval '1 hour' then
      raise exception using errcode = '55000', message = 'timezone_change_too_frequent';
    end if;
    new.timezone_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_guard_timezone
  before update of timezone on profiles
  for each row execute function public.profiles_guard_timezone();

-- ---------- 7. права service_role для серверной записи нового кода ----------
--
-- Новый код пишет отметку заморозки (activity_days) и достижения (user_achievements) сервисной
-- ролью. На Supabase у service_role такие права есть по умолчанию; явная выдача делает миграцию
-- независимой от настроек default privileges. Права клиентской роли здесь НЕ меняются (0060).

grant select, insert, update on activity_days to service_role;
grant select, insert on user_achievements to service_role;

-- ---------- 8. типы ежедневных заданий ----------
--
-- Здесь НЕ расширяется: check на quest_type остаётся прежним до 0060. Старый интерфейс не умеет
-- показывать неизвестный тип задания и упал бы на строке, которую создал новый код. Пока фаза
-- overlap, новый код выдаёт только прежние типы; новые (earn_xp, complete_lessons,
-- answer_exercises) включает 0060.

-- ---------- 8b. завершённые попытки уроков ----------

create index lesson_attempts_user_completed_idx
  on lesson_attempts (user_id, completed_at desc)
  where status = 'completed';

-- ---------- 10. завершение выкладки ----------
--
-- Вызывается ТОЛЬКО из 0060 (или вручную на окружении без старого приложения, где 0060 не
-- нужна — например, на тестовой базе). Переносит накопленные в overlap события в счётчики и
-- включает фазу live. Идемпотентна: повторный вызов ничего не делает.
--
-- Почему это безопасно для старого приложения, которое ещё могло дожить до этого момента:
--   • блокировка флага (for update) дожидается всех начислений в полёте, новые ждут за ней;
--   • lock table … share row exclusive на profiles и activity_days дожидается записей старого
--     кода в полёте и держит новые, пока идёт перенос: «чтение старым → запись старым» не может
--     вклиниться между расчётом суммы и её записью. Блокировка берётся ПЕРВОЙ, до переноса и до
--     DDL из 0060, поэтому не возникает взаимной блокировки «старый запрос ждёт строку, которую
--     держит перенос, а перенос ждёт блокировку таблицы, которую держит этот старый запрос»
--     (без неё PostgreSQL разрывает такой цикл, но жертвой случайно оказывается то миграция, то
--     старый запрос — supabase/tests/race_0060.sh, мутация без блокировки). Читать таблицы можно всё время;
--   • запись старого кода, ожидавшая блокировку, после коммита упирается в запрет из 0060 (42501)
--     — так и задумано: к этому моменту старых инстансов быть не должно.
-- lock_timeout (10 с) держится до конца транзакции, и при его срабатывании откатывается всё —
-- миграцию можно запустить заново, ничего не потеряно и не применено наполовину.
create or replace function public.finish_rewards_rollout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phase text;
  v_events bigint;
  v_xp bigint;
  v_marks bigint;
begin
  perform set_config('lock_timeout', '10s', true);

  select rewards_phase into v_phase from public.rollout_state for update;
  if v_phase = 'live' then
    return jsonb_build_object('status', 'already_live');
  end if;

  lock table public.profiles, public.activity_days in share row exclusive mode;

  select count(*), coalesce(sum(amount), 0) into v_events, v_xp from public.xp_events where not applied;
  select count(*) into v_marks from public.pending_goal_marks;

  -- 1. общий XP профилей: прежнее значение (его писал старый код) плюс накопленное
  update public.profiles p
     set xp = p.xp + pending.xp
    from (select user_id, sum(amount)::int as xp from public.xp_events where not applied group by user_id) pending
   where p.id = pending.user_id;

  -- 2. XP по дням (UTC-дни overlap совпадают со строками, которые писал старый код)
  insert into public.activity_days as ad (user_id, day, xp, goal_met)
  select user_id, day, sum(amount)::int, false from public.xp_events where not applied group by user_id, day
  on conflict (user_id, day) do update set xp = ad.xp + excluded.xp;

  -- 3. цель в XP закрыта, если за день набрано не меньше цели (отметка только растёт)
  update public.activity_days ad
     set goal_met = true
    from public.profiles p
   where p.id = ad.user_id
     and not ad.goal_met
     and p.daily_goal_type = 'xp'
     and ad.xp >= p.daily_xp_goal
     and exists (select 1 from public.xp_events e where e.user_id = ad.user_id and e.day = ad.day and not e.applied);

  -- 4. отметки целей не в XP
  insert into public.activity_days as ad (user_id, day, xp, goal_met)
  select user_id, day, 0, true from public.pending_goal_marks
  on conflict (user_id, day) do update set goal_met = true;
  delete from public.pending_goal_marks;

  -- 5. журнал и фаза
  update public.xp_events set applied = true where not applied;
  update public.rollout_state set rewards_phase = 'live', changed_at = now();

  return jsonb_build_object('status', 'finished', 'events', v_events, 'xp', v_xp, 'goal_marks', v_marks);
end;
$$;

revoke all on function public.finish_rewards_rollout() from public, anon, authenticated;
grant execute on function public.finish_rewards_rollout() to service_role;

-- Откат (не выполняется — миграция аддитивна). Выполнять, только если 0060 НЕ применена
-- (неприменённые события в xp_events при откате пропадут вместе с таблицей — сначала вызовите
-- select public.finish_rewards_rollout(), если новое приложение успело что-то начислить):
--
-- drop index if exists lesson_attempts_user_completed_idx;
-- drop function if exists public.finish_rewards_rollout();
-- drop function if exists public.rewards_phase();
-- drop table if exists pending_goal_marks;
-- drop table if exists rollout_state;
-- drop function if exists public.mark_goal_met(uuid, date);
-- drop trigger if exists profiles_guard_timezone on profiles;
-- drop function if exists public.profiles_guard_timezone();
-- drop function if exists public.award_xp(uuid, text, text, int, int);
-- drop table if exists xp_events;
-- alter table profiles drop column daily_goal_target;
-- alter table profiles drop column daily_goal_type;
-- alter table profiles drop column timezone_changed_at;
-- alter table profiles drop column timezone;
