-- docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
-- "Живые дуэли по словарю 1 на 1".
--
-- === Живая проверка ===
-- Supabase Realtime уже часть стека (supabase/config.toml [realtime]
-- enabled=true, контейнер supabase_realtime_* уже поднят,
-- @supabase/supabase-js уже включает realtime-клиент в том же пакете) —
-- новой инфраструктуры не нужно. До этой миграции realtime не
-- использовался в проекте вообще (0 строк с .channel(/broadcast/presence
-- в src/, supabase_realtime publication была пуста).
--
-- Случайный оппонент требует живого пула одновременно ищущих игроков —
-- у проекта его нет (0 realtime-фич до сегодня, лидерборд из PR #44 —
-- первая межпользовательская фича вообще, и та не требует одновременного
-- присутствия). Честный MVP — только "пригласи друга по ссылке": никакой
-- matchmaking-очереди, которая будет пустовать и крутить бесконечный
-- спиннер для первых пользователей.
--
-- === Модель безопасности (переиспользует паттерн PR #44) ===
-- duel_rounds.correct_answer в сыром виде — это сам ответ на вопрос:
-- RLS-политика вида "участник видит свою строку" фильтрует СТРОКИ, не
-- КОЛОНКИ — она бы честно отдала correct_answer ДО того, как игрок
-- ответил. Поэтому duel_rounds/duel_answers не получают вообще НИКАКИХ
-- грантов/политик для authenticated (RLS enabled, ноль policy = полный
-- запрет; таблицы читает/пишет только владелец миграции — тот же, кто
-- определяет SECURITY DEFINER функции ниже, обходит RLS по умолчанию как
-- владелец). Единственный путь к ним — explicit-перечисленные функции:
--   - get_duel_state()  — читает и МАСКИРУЕТ correct_answer/чужой ответ
--                         текущего раунда, пока раунд не завершён;
--   - deal_duel_round() — раунд формирует доверенный TS Server Action
--                         (нужен внешний перевод слова — cachedTranslate,
--                         недоступен из чистого SQL), эта функция только
--                         проверяет, что вызывающий — участник активной
--                         дуэли, и что это следующий ожидаемый раунд;
--   - submit_duel_answer() — сама считает correctness/latency_ms на
--                         сервере (не по данным клиента) — прямое
--                         требование задачи "время на ответ проверяется
--                         сервером, не только клиентом";
--   - resolve_duel_round_timeout() — форс-резолвит раунд, если один игрок
--                         пропал/не ответил вовремя — дуэль не виснет
--                         навсегда для второго игрока.
-- duels — единственная из трёх таблиц с обычной RLS-политикой + грантом
-- SELECT authenticated: в ней нет ни одной "секретной" колонки (статус,
-- счёт, инициалы), и ей ОБЯЗАН быть доступен realtime postgres_changes
-- (Supabase Realtime сверяет RLS SELECT самого коннекта, чтобы решить,
-- доставлять ли событие) — без этой политики ни один клиент не получил
-- бы вообще ни одного realtime-события. Realtime здесь используется
-- только как сигнал "что-то изменилось, перезапроси get_duel_state()",
-- не как канал доставки самих данных раунда.
create table duels (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  creator_initials text not null,
  opponent_id uuid references profiles(id) on delete cascade,
  opponent_initials text,
  language text not null,
  -- Создателя native_language, снятый один раз при create_duel() — язык
  -- перевода вариантов ответа для ВСЕЙ дуэли (создатель и приглашённый
  -- друг вполне могут иметь разные родные языки). Хранится здесь, а не
  -- перечитывается из profiles каждый раз при сдаче раунда: обычный
  -- RLS-клиент оппонента не может прочитать profiles создателя вообще
  -- (owner-only политика), а create_duel() как SECURITY DEFINER видит
  -- profiles создателя ровно один раз, в момент вызова auth.uid()=создатель.
  native_language text not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  round_count integer not null,
  current_round_index integer not null default 0,
  creator_score integer not null default 0,
  opponent_score integer not null default 0,
  -- on delete cascade, не set null -- e2e/account-delete-export.spec.ts
  -- проверяет, что КАЖДЫЙ FK на profiles каскадно удаляется при удалении
  -- аккаунта (обнаружено через pg_constraint динамически, не хардкод
  -- списка таблиц) — ни одна user-owned строка не должна переживать
  -- удаление владельца с "осиротевшей" ссылкой. На практике не меняет
  -- поведение: winner_id всегда равен creator_id либо opponent_id (или
  -- null), у обоих уже on delete cascade — вся строка дуэли и так
  -- удалится по одному из них раньше, чем сработал бы этот FK.
  winner_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  -- Единственная цель этой колонки — realtime-сигнал: клиент подписан на
  -- postgres_changes по duels (единственная из трёх таблиц с открытым
  -- SELECT), но не на каждое мутирующее событие приходится "естественное"
  -- изменение duels (неверный ответ, например, не трогает
  -- creator_score/opponent_score вообще) — каждая функция ниже, меняющая
  -- игровое состояние, явно бампает updated_at, чтобы оба клиента узнали
  -- "что-то произошло, перезапроси get_duel_state()" даже когда ни одна
  -- "содержательная" колонка не изменилась.
  updated_at timestamptz not null default now()
);

create table duel_rounds (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references duels(id) on delete cascade,
  round_index integer not null,
  word text not null,
  correct_answer text not null,
  options jsonb not null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (duel_id, round_index)
);

create table duel_answers (
  id uuid primary key default gen_random_uuid(),
  duel_round_id uuid not null references duel_rounds(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  answer text not null,
  is_correct boolean not null,
  latency_ms integer not null,
  answered_at timestamptz not null default now(),
  unique (duel_round_id, user_id)
);

create index duels_creator_idx on duels (creator_id);
create index duels_opponent_idx on duels (opponent_id);
create index duel_rounds_duel_idx on duel_rounds (duel_id);
create index duel_answers_round_idx on duel_answers (duel_round_id);

alter table duels enable row level security;
alter table duel_rounds enable row level security;
alter table duel_answers enable row level security;

create policy "duels: participants or a waiting duel's preview" on duels
  for select
  using (status = 'waiting' or auth.uid() = creator_id or auth.uid() = opponent_id);
grant select on duels to authenticated;

-- duel_rounds/duel_answers: намеренно ни одной policy, ни одного гранта
-- для authenticated/anon — см. комментарий выше.
grant select, insert, update, delete on duels, duel_rounds, duel_answers to service_role;

alter publication supabase_realtime add table duels;

-- Общий лимит времени на раунд (мс) — зеркалируется в
-- src/lib/duel.ts (DUEL_ROUND_TIME_LIMIT_MS); нет способа буквально
-- разделить одну константу между SQL и TS, поэтому обе стороны
-- ссылаются друг на друга в комментариях, тот же подход, что и у
-- growth.ts/share-card геометрии (PR "Визуальный Language Twin").
create or replace function public.duel_round_time_limit_ms()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10000 $$;

create or replace function public.create_duel(p_round_count integer default 7)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text;
  v_native_language text;
  v_email text;
  v_duel_id uuid;
begin
  if p_round_count < 3 or p_round_count > 15 then
    raise exception using errcode = '22023', message = 'invalid_round_count';
  end if;

  select target_language, native_language into v_language, v_native_language
    from public.profiles where id = auth.uid();
  if v_language is null then
    raise exception using errcode = '22023', message = 'profile_not_found';
  end if;
  -- src/lib/languages.ts READY_LANGUAGES — тот же список слов (NGSL,
  -- PR #39), что и стартовые колоды, English-only.
  if v_language <> 'en' then
    raise exception using errcode = '22023', message = 'language_not_supported';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.duels (creator_id, creator_initials, language, native_language, round_count)
  values (
    auth.uid(),
    upper(left(regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9]', '', 'g'), 2)),
    v_language,
    v_native_language,
    p_round_count
  )
  returning id into v_duel_id;

  return v_duel_id;
end;
$$;
revoke all on function public.create_duel(integer) from public, anon;
grant execute on function public.create_duel(integer) to authenticated;

create or replace function public.join_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.duels;
  v_my_language text;
  v_email text;
begin
  -- for update сериализует конкурентные join-попытки на одну и ту же
  -- дуэль -- вторая транзакция ждёт первую, затем видит уже
  -- проставленный opponent_id и честно падает вместо двойного джойна.
  select * into v_duel from public.duels where id = p_duel_id for update;
  if v_duel.id is null then
    raise exception using errcode = 'P0002', message = 'duel_not_found';
  end if;
  if v_duel.status <> 'waiting' or v_duel.opponent_id is not null then
    raise exception using errcode = '22023', message = 'duel_not_joinable';
  end if;
  if v_duel.creator_id = auth.uid() then
    raise exception using errcode = '22023', message = 'cannot_join_own_duel';
  end if;

  select target_language into v_my_language from public.profiles where id = auth.uid();
  if v_my_language is distinct from v_duel.language then
    raise exception using errcode = '22023', message = 'language_mismatch';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  update public.duels
  set opponent_id = auth.uid(),
      opponent_initials = upper(left(regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9]', '', 'g'), 2)),
      status = 'active',
      started_at = now(),
      updated_at = now()
  where id = p_duel_id;
end;
$$;
revoke all on function public.join_duel(uuid) from public, anon;
grant execute on function public.join_duel(uuid) to authenticated;

create or replace function public.deal_duel_round(
  p_duel_id uuid,
  p_round_index integer,
  p_word text,
  p_correct_answer text,
  p_options jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.duels;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if v_duel.id is null then
    raise exception using errcode = 'P0002', message = 'duel_not_found';
  end if;
  if auth.uid() <> v_duel.creator_id and auth.uid() <> v_duel.opponent_id then
    raise exception using errcode = '42501', message = 'not_a_participant';
  end if;
  if v_duel.status <> 'active' then
    raise exception using errcode = '22023', message = 'duel_not_active';
  end if;
  if p_round_index <> v_duel.current_round_index + 1 then
    -- Идемпотентный no-op: второй клиент уже сдал этот раунд первым (или
    -- это устаревший повторный вызов) -- не ошибка, просто нечего делать.
    return;
  end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) < 2 then
    raise exception using errcode = '22023', message = 'invalid_options';
  end if;
  if not exists (select 1 from jsonb_array_elements_text(p_options) e where e = p_correct_answer) then
    raise exception using errcode = '22023', message = 'correct_answer_not_in_options';
  end if;

  insert into public.duel_rounds (duel_id, round_index, word, correct_answer, options)
  values (p_duel_id, p_round_index, p_word, p_correct_answer, p_options);

  update public.duels set current_round_index = p_round_index, updated_at = now() where id = p_duel_id;
end;
$$;
revoke all on function public.deal_duel_round(uuid, integer, text, text, jsonb) from public, anon;
grant execute on function public.deal_duel_round(uuid, integer, text, text, jsonb) to authenticated;

create or replace function public.submit_duel_answer(
  p_duel_id uuid,
  p_round_index integer,
  p_answer text
)
returns table (
  is_correct boolean,
  correct_answer text,
  latency_ms integer,
  round_resolved boolean,
  duel_finished boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.duels;
  v_round public.duel_rounds;
  v_latency integer;
  v_correct boolean;
  v_other_user uuid;
  v_other_answered boolean;
  v_resolved boolean := false;
  v_finished boolean := false;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if v_duel.id is null then
    raise exception using errcode = 'P0002', message = 'duel_not_found';
  end if;
  if auth.uid() <> v_duel.creator_id and auth.uid() <> v_duel.opponent_id then
    raise exception using errcode = '42501', message = 'not_a_participant';
  end if;

  select * into v_round from public.duel_rounds where duel_id = p_duel_id and round_index = p_round_index;
  if v_round.id is null then
    raise exception using errcode = 'P0002', message = 'round_not_found';
  end if;
  if exists (select 1 from public.duel_answers where duel_round_id = v_round.id and user_id = auth.uid()) then
    raise exception using errcode = '22023', message = 'already_answered';
  end if;

  -- Латентность и корректность -- обе честно на сервере, не по тому, что
  -- прислал клиент (задача: "время на ответ должно проверяться сервером,
  -- не только клиентом"). Ответ ПОСЛЕ лимита засчитывается как неверный
  -- независимо от текста, даже если он буквально правильный.
  v_latency := greatest(0, round(extract(epoch from (now() - v_round.started_at)) * 1000))::integer;
  v_correct := (p_answer = v_round.correct_answer) and v_latency <= public.duel_round_time_limit_ms();

  insert into public.duel_answers (duel_round_id, user_id, answer, is_correct, latency_ms)
  values (v_round.id, auth.uid(), p_answer, v_correct, v_latency);

  -- Безусловный бамп -- неверный ответ не трогает ни одну другую колонку
  -- duels вообще, но соперник всё равно должен узнать через realtime, что
  -- кто-то уже ответил (round.opponentAnswered в get_duel_state).
  update public.duels set updated_at = now() where id = p_duel_id;

  if v_correct then
    if auth.uid() = v_duel.creator_id then
      update public.duels set creator_score = creator_score + 1, updated_at = now() where id = p_duel_id;
    else
      update public.duels set opponent_score = opponent_score + 1, updated_at = now() where id = p_duel_id;
    end if;
  end if;

  v_other_user := case when auth.uid() = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end;
  select exists(
    select 1 from public.duel_answers where duel_round_id = v_round.id and user_id = v_other_user
  ) into v_other_answered;

  if v_other_answered then
    update public.duel_rounds set resolved_at = now() where id = v_round.id and resolved_at is null;
    v_resolved := true;
    if p_round_index >= v_duel.round_count then
      -- creator_score/opponent_score здесь уже включают инкремент этого
      -- раунда из UPDATE выше (видим собственные изменения в той же
      -- транзакции).
      update public.duels d
      set status = 'finished', finished_at = now(), updated_at = now(),
          winner_id = case
            when d.creator_score > d.opponent_score then d.creator_id
            when d.opponent_score > d.creator_score then d.opponent_id
            else null
          end
      where d.id = p_duel_id;
      v_finished := true;
    end if;
  end if;

  return query select v_correct, v_round.correct_answer, v_latency, v_resolved, v_finished;
end;
$$;
revoke all on function public.submit_duel_answer(uuid, integer, text) from public, anon;
grant execute on function public.submit_duel_answer(uuid, integer, text) to authenticated;

create or replace function public.resolve_duel_round_timeout(p_duel_id uuid, p_round_index integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.duels;
  v_round public.duel_rounds;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if v_duel.id is null or (auth.uid() <> v_duel.creator_id and auth.uid() <> v_duel.opponent_id) then
    raise exception using errcode = '42501', message = 'not_a_participant';
  end if;

  select * into v_round from public.duel_rounds where duel_id = p_duel_id and round_index = p_round_index;
  if v_round.id is null or v_round.resolved_at is not null then
    return;
  end if;
  if extract(epoch from (now() - v_round.started_at)) * 1000 < public.duel_round_time_limit_ms() then
    raise exception using errcode = '22023', message = 'round_not_timed_out_yet';
  end if;

  -- Кто не успел ответить -- получает зафиксированный неответ (никогда не
  -- верный, latency прибита к лимиту), чтобы дуэль не висела вечно, если
  -- вкладка одного игрока отвалилась.
  insert into public.duel_answers (duel_round_id, user_id, answer, is_correct, latency_ms)
  select v_round.id, v_duel.creator_id, '', false, public.duel_round_time_limit_ms()
  where not exists (
    select 1 from public.duel_answers where duel_round_id = v_round.id and user_id = v_duel.creator_id
  );

  insert into public.duel_answers (duel_round_id, user_id, answer, is_correct, latency_ms)
  select v_round.id, v_duel.opponent_id, '', false, public.duel_round_time_limit_ms()
  where v_duel.opponent_id is not null
    and not exists (
      select 1 from public.duel_answers where duel_round_id = v_round.id and user_id = v_duel.opponent_id
    );

  update public.duel_rounds set resolved_at = now() where id = v_round.id;
  update public.duels set updated_at = now() where id = p_duel_id;

  if p_round_index >= v_duel.round_count then
    update public.duels d
    set status = 'finished', finished_at = now(), updated_at = now(),
        winner_id = case
          when d.creator_score > d.opponent_score then d.creator_id
          when d.opponent_score > d.creator_score then d.opponent_id
          else null
        end
    where d.id = p_duel_id;
  end if;
end;
$$;
revoke all on function public.resolve_duel_round_timeout(uuid, integer) from public, anon;
grant execute on function public.resolve_duel_round_timeout(uuid, integer) to authenticated;

-- Единственная точка чтения раундов/ответов текущего раунда -- см.
-- комментарий в шапке файла про маскировку correct_answer/чужого ответа.
-- waiting-дуэль (ещё нет current_round_index > 0) видна и не-участнику
-- (страница "войти по ссылке" до присоединения), active/finished -- только
-- участникам.
create or replace function public.get_duel_state(p_duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_duel public.duels;
  v_is_participant boolean;
  v_round public.duel_rounds;
  v_my_answer public.duel_answers;
  v_opp_answer public.duel_answers;
  v_opp_id uuid;
  v_result jsonb;
begin
  select * into v_duel from public.duels where id = p_duel_id;
  if v_duel.id is null then
    return null;
  end if;

  -- coalesce(..., false): opponent_id is null for a still-waiting duel, and
  -- `auth.uid() = null` is SQL NULL (not false) -- without this a genuine
  -- non-participant previewing a waiting duel would see isParticipant:
  -- null instead of false (found live, exactly this scenario).
  v_is_participant := coalesce(auth.uid() = v_duel.creator_id or auth.uid() = v_duel.opponent_id, false);
  if not v_is_participant and v_duel.status <> 'waiting' then
    raise exception using errcode = '42501', message = 'not_a_participant';
  end if;

  v_result := jsonb_build_object(
    'id', v_duel.id,
    'status', v_duel.status,
    'language', v_duel.language,
    'roundCount', v_duel.round_count,
    'currentRoundIndex', v_duel.current_round_index,
    'creatorInitials', v_duel.creator_initials,
    'opponentInitials', v_duel.opponent_initials,
    'creatorScore', v_duel.creator_score,
    'opponentScore', v_duel.opponent_score,
    'isCreator', v_is_participant and auth.uid() = v_duel.creator_id,
    'isParticipant', v_is_participant,
    'winnerIsMe', v_duel.winner_id is not null and v_duel.winner_id = auth.uid(),
    'isDraw', v_duel.status = 'finished' and v_duel.winner_id is null
  );

  if v_is_participant and v_duel.current_round_index > 0 then
    select * into v_round from public.duel_rounds
      where duel_id = p_duel_id and round_index = v_duel.current_round_index;
    if v_round.id is not null then
      select * into v_my_answer from public.duel_answers
        where duel_round_id = v_round.id and user_id = auth.uid();
      v_opp_id := case when auth.uid() = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end;
      if v_opp_id is not null then
        select * into v_opp_answer from public.duel_answers
          where duel_round_id = v_round.id and user_id = v_opp_id;
      end if;

      v_result := v_result || jsonb_build_object(
        'round', jsonb_build_object(
          'index', v_round.round_index,
          'word', v_round.word,
          'options', v_round.options,
          'startedAt', v_round.started_at,
          'resolvedAt', v_round.resolved_at,
          'correctAnswer', case when v_round.resolved_at is not null then v_round.correct_answer else null end,
          'myAnswer', case when v_my_answer.id is not null
            then jsonb_build_object('answer', v_my_answer.answer, 'isCorrect', v_my_answer.is_correct, 'latencyMs', v_my_answer.latency_ms)
            else null end,
          'opponentAnswered', v_opp_answer.id is not null,
          'opponentAnswer', case when v_round.resolved_at is not null and v_opp_answer.id is not null
            then jsonb_build_object('answer', v_opp_answer.answer, 'isCorrect', v_opp_answer.is_correct, 'latencyMs', v_opp_answer.latency_ms)
            else null end
        )
      );
    end if;
  end if;

  return v_result;
end;
$$;
revoke all on function public.get_duel_state(uuid) from public, anon;
grant execute on function public.get_duel_state(uuid) to authenticated;

-- Откат:
-- alter publication supabase_realtime drop table duels;
-- drop function if exists public.get_duel_state(uuid);
-- drop function if exists public.resolve_duel_round_timeout(uuid, integer);
-- drop function if exists public.submit_duel_answer(uuid, integer, text);
-- drop function if exists public.deal_duel_round(uuid, integer, text, text, jsonb);
-- drop function if exists public.join_duel(uuid);
-- drop function if exists public.create_duel(integer);
-- drop function if exists public.duel_round_time_limit_ms();
-- drop table if exists duel_answers;
-- drop table if exists duel_rounds;
-- drop table if exists duels;
