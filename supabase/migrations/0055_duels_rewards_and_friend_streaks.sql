-- docs/moments/ROADMAP.md, этап 6 — Duel-invite/Duel-won (дуэли есть,
-- src/lib/duel.ts, но без реального XP за победу, серии побед подряд,
-- разницы в секундах и живого таймера приглашения), Overtaken/Weekly-rank
-- (лидерборд есть, src/lib/leaderboard.ts, но без "друзей" и без снимка
-- прошлого ранга, нужных для детекта обгона), Friend-streak (новая
-- механика — общая серия двух друзей).
--
-- === Дуэли: недостающие данные (а не просто недостающая колонка) ===
-- Макеты Duel-invite/Duel-won показывают привязку дуэли к конкретной книге и
-- "прогресс соперника 8 из 10" ДО старта раундов — это физически
-- невозможные данные в текущей модели (дуэль — синхронные раунды по словам
-- NGSL, не по книге; до join никто ничего не "решил"), поэтому экраны
-- адаптируют текст, а не выдумывают колонки под них. XP за победу/серию
-- побед подряд/разницу в секундах — наоборот, честно недостающая логика,
-- добавляем её здесь.
alter table profiles add column duel_win_streak int not null default 0;

alter table duels add column invite_expires_at timestamptz not null default now() + interval '24 hours';
alter table duels add column creator_xp_awarded boolean not null default false;
alter table duels add column opponent_xp_awarded boolean not null default false;

-- Фиксированная награда за победу — то же число, что в
-- docs/moments/mockups/Duel-won.dc.html ("+25 XP"), константа, как
-- PERFECT_BONUS_XP у Perfect-момента.
create or replace function public.duel_win_xp_reward()
returns integer
language sql
immutable
set search_path = ''
as $$ select 25 $$;

-- claim_duel_result() — вызывается один раз с каждой стороны после
-- status = 'finished'. Считает speed_margin_sec из РЕАЛЬНЫХ
-- duel_answers.latency_ms (сумма по решённым раундам, своя минус чужая,
-- в секундах; отрицательное значение — вызывающий был медленнее), обновляет
-- duel_win_streak (победа — +1, поражение — обрыв в 0, ничья — не трогаем)
-- и защищает от повторного начисления XP через creator_xp_awarded/
-- opponent_xp_awarded. Начисление самого XP (addXp) — на TS-стороне
-- (src/app/(app)/duel/actions.ts::claimDuelResultAction), эта функция
-- только считает и отдаёт xpToAward.
create or replace function public.claim_duel_result(p_duel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.duels;
  v_is_creator boolean;
  v_already_claimed boolean;
  v_i_won boolean;
  v_is_draw boolean;
  v_my_latency_ms bigint;
  v_opp_latency_ms bigint;
  v_opp_id uuid;
  v_win_streak int;
  v_xp_to_award int := 0;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if v_duel.id is null then
    raise exception using errcode = 'P0002', message = 'duel_not_found';
  end if;
  if auth.uid() <> v_duel.creator_id and auth.uid() <> v_duel.opponent_id then
    raise exception using errcode = '42501', message = 'not_a_participant';
  end if;
  if v_duel.status <> 'finished' then
    raise exception using errcode = '22023', message = 'duel_not_finished';
  end if;

  v_is_creator := auth.uid() = v_duel.creator_id;
  v_already_claimed := case when v_is_creator then v_duel.creator_xp_awarded else v_duel.opponent_xp_awarded end;
  v_i_won := v_duel.winner_id is not null and v_duel.winner_id = auth.uid();
  v_is_draw := v_duel.winner_id is null;
  v_opp_id := case when v_is_creator then v_duel.opponent_id else v_duel.creator_id end;

  select coalesce(sum(da.latency_ms), 0) into v_my_latency_ms
    from public.duel_answers da
    join public.duel_rounds dr on dr.id = da.duel_round_id
    where dr.duel_id = p_duel_id and da.user_id = auth.uid();
  select coalesce(sum(da.latency_ms), 0) into v_opp_latency_ms
    from public.duel_answers da
    join public.duel_rounds dr on dr.id = da.duel_round_id
    where dr.duel_id = p_duel_id and da.user_id = v_opp_id;

  if not v_already_claimed then
    if v_i_won then
      update public.profiles set duel_win_streak = duel_win_streak + 1 where id = auth.uid()
        returning duel_win_streak into v_win_streak;
      v_xp_to_award := public.duel_win_xp_reward();
    elsif not v_is_draw then
      update public.profiles set duel_win_streak = 0 where id = auth.uid()
        returning duel_win_streak into v_win_streak;
    else
      select duel_win_streak into v_win_streak from public.profiles where id = auth.uid();
    end if;

    if v_is_creator then
      update public.duels set creator_xp_awarded = true, updated_at = now() where id = p_duel_id;
    else
      update public.duels set opponent_xp_awarded = true, updated_at = now() where id = p_duel_id;
    end if;
  else
    select duel_win_streak into v_win_streak from public.profiles where id = auth.uid();
  end if;

  return jsonb_build_object(
    'xpToAward', v_xp_to_award,
    'winStreak', v_win_streak,
    'speedMarginSec', round((v_opp_latency_ms - v_my_latency_ms) / 1000.0)::int,
    'scoreMe', case when v_is_creator then v_duel.creator_score else v_duel.opponent_score end,
    'scoreOpponent', case when v_is_creator then v_duel.opponent_score else v_duel.creator_score end
  );
end;
$$;
revoke all on function public.claim_duel_result(uuid) from public, anon;
grant execute on function public.claim_duel_result(uuid) to authenticated;

-- get_duel_state(): та же функция из 0050_vocabulary_duels.sql,
-- create or replace с добавленным inviteExpiresAt (только осмысленно пока
-- status = 'waiting', но отдаём всегда — клиент сам решает, показывать ли).
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
    'isDraw', v_duel.status = 'finished' and v_duel.winner_id is null,
    'inviteExpiresAt', v_duel.invite_expires_at
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

-- === Weekly-rank: прошлая неделя по требованию (не только текущая) ===
-- get_weekly_leaderboard() (0049) хардкодит date_trunc('week', now()) —
-- Weekly-rank-момент показывается в понедельник ПРО ЗАКОНЧИВШУЮСЯ неделю,
-- поэтому нужна параметризованная версия; старая функция становится тонкой
-- обёрткой над новой с текущей неделей, вызывающий код (/leaderboard/page.tsx)
-- не меняется.
create or replace function public.get_weekly_leaderboard_for_week(p_week_start date)
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
          and rl.reviewed_at >= p_week_start
          and rl.reviewed_at < p_week_start + interval '7 days'
      ) as reviews_count,
      (
        select count(*)::int
        from public.vocabulary_items vi
        where vi.owner_id = p.id
          and vi.created_at >= p_week_start
          and vi.created_at < p_week_start + interval '7 days'
      ) as words_count
    from public.profiles p
    where p.leaderboard_opt_in = true
  ),
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
revoke all on function public.get_weekly_leaderboard_for_week(date) from public, anon;
grant execute on function public.get_weekly_leaderboard_for_week(date) to authenticated;

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
  select * from public.get_weekly_leaderboard_for_week(
    (date_trunc('week', now() at time zone 'utc'))::date
  );
$$;
revoke all on function public.get_weekly_leaderboard() from public, anon;
grant execute on function public.get_weekly_leaderboard() to authenticated;

-- Снимок своего ранга за неделю — Overtaken сравнивает ранг друга СЕЙЧАС
-- с тем, что было при прошлом снимке, иначе "обогнал" нельзя отличить от
-- "всегда был выше". Только свой собственный ряд (owner_id = auth.uid()),
-- обычная владельческая RLS-политика, как у activity_days.
create table weekly_rank_snapshots (
  owner_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  rank int not null,
  score int not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, week_start)
);

alter table weekly_rank_snapshots enable row level security;

create policy "weekly_rank_snapshots: owner full access" on weekly_rank_snapshots
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on weekly_rank_snapshots to authenticated;

-- === Friend-streak: общая серия двух друзей ===
-- Единственный "друг"-концепт в проекте — пара friend_streaks и есть сама
-- связь (как мы договорились, отдельной generic-таблицы friends не делаем).
-- Приглашение — по одноразовой ссылке, тот же честный MVP, что у дуэлей
-- (0050: "никакого matchmaking, который будет пустовать").
--
-- user_a_initials/user_b_initials/*_personal_streak -- СНИМКИ, не live join:
-- participant видит свою строку по RLS (владеет через user_a/user_b), но
-- profiles партнёра ему по RLS не видна (владельческая политика на profiles)
-- -- тот же паттерн, что creator_initials/opponent_initials у duels, только
-- обновляется периодически (при каждом touch_friend_streaks), а не один раз.
create table friend_streaks (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_a_initials text not null,
  user_a_personal_streak int not null default 0,
  user_b uuid references profiles(id) on delete cascade,
  user_b_initials text,
  user_b_personal_streak int not null default 0,
  streak int not null default 0,
  last_both_active_day date,
  invite_token uuid not null default gen_random_uuid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index friend_streaks_token_idx on friend_streaks (invite_token);
-- Не даём один и тот же принятый дуэт создать дважды (в любом порядке
-- user_a/user_b) -- не критично для MVP, но дёшево гарантировать в БД.
create unique index friend_streaks_pair_idx on friend_streaks (least(user_a, user_b), greatest(user_a, user_b))
  where accepted_at is not null;

alter table friend_streaks enable row level security;

create policy "friend_streaks: participants can read" on friend_streaks
  for select using (auth.uid() = user_a or auth.uid() = user_b);
grant select on friend_streaks to authenticated;

-- Намеренно без insert/update/delete для authenticated -- как
-- duel_rounds/duel_answers, мутации только через SECURITY DEFINER функции
-- ниже (иначе любая сторона могла бы сама себе накрутить streak).
grant select, insert, update, delete on friend_streaks to service_role;

create or replace function public.create_friend_streak_invite()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_initials text;
  v_streak int;
  v_token uuid;
begin
  select email into v_email from auth.users where id = auth.uid();
  select streak_current into v_streak from public.profiles where id = auth.uid();
  v_initials := upper(left(regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9]', '', 'g'), 2));

  insert into public.friend_streaks (user_a, user_a_initials, user_a_personal_streak)
  values (auth.uid(), v_initials, coalesce(v_streak, 0))
  returning invite_token into v_token;

  return v_token;
end;
$$;
revoke all on function public.create_friend_streak_invite() from public, anon;
grant execute on function public.create_friend_streak_invite() to authenticated;

create or replace function public.accept_friend_streak_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.friend_streaks;
  v_email text;
  v_initials text;
  v_streak int;
begin
  select * into v_row from public.friend_streaks where invite_token = p_token for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'invite_not_found';
  end if;
  if v_row.accepted_at is not null then
    raise exception using errcode = '22023', message = 'invite_already_used';
  end if;
  if v_row.user_a = auth.uid() then
    raise exception using errcode = '22023', message = 'cannot_accept_own_invite';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  select streak_current into v_streak from public.profiles where id = auth.uid();
  v_initials := upper(left(regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9]', '', 'g'), 2));

  update public.friend_streaks
  set user_b = auth.uid(), user_b_initials = v_initials, user_b_personal_streak = coalesce(v_streak, 0), accepted_at = now()
  where id = v_row.id;

  return v_row.id;
end;
$$;
revoke all on function public.accept_friend_streak_invite(uuid) from public, anon;
grant execute on function public.accept_friend_streak_invite(uuid) to authenticated;

-- touch_friend_streaks() -- вызывается из src/lib/streak.ts::touchStreak()
-- сразу после того, как личная серия вызывающего обновлена (он точно активен
-- сегодня, иначе touchStreak не стал бы ничего трогать). Для каждой принятой
-- пары с вызывающим: обновляет его собственный кэш personal_streak,
-- и если партнёр тоже отмечен активным p_day в activity_days и общая серия
-- ещё не трогалась сегодня -- продолжает (вчера -> сегодня) либо начинает
-- заново (разрыв/первый раз) общую streak. Возвращает затронутые строки,
-- чтобы TS-слой мог сразу построить FriendStreakMoment без лишнего запроса.
create or replace function public.touch_friend_streaks(p_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_is_a boolean;
  v_partner_id uuid;
  v_my_streak int;
  v_partner_active boolean;
  v_results jsonb := '[]'::jsonb;
begin
  select streak_current into v_my_streak from public.profiles where id = auth.uid();

  for v_row in
    select * from public.friend_streaks
    where accepted_at is not null and (user_a = auth.uid() or user_b = auth.uid())
    for update
  loop
    v_is_a := v_row.user_a = auth.uid();
    v_partner_id := case when v_is_a then v_row.user_b else v_row.user_a end;

    if v_is_a then
      update public.friend_streaks set user_a_personal_streak = coalesce(v_my_streak, 0) where id = v_row.id;
    else
      update public.friend_streaks set user_b_personal_streak = coalesce(v_my_streak, 0) where id = v_row.id;
    end if;

    if v_row.last_both_active_day = p_day then
      continue; -- уже посчитан сегодня (второй вызов за день — идемпотентно)
    end if;

    select exists(
      select 1 from public.activity_days
      where user_id = v_partner_id and day = p_day and (xp > 0 or minutes > 0 or lessons > 0)
    ) into v_partner_active;

    if not v_partner_active then
      continue; -- партнёр ещё не занимался сегодня — ждём его собственного touch
    end if;

    update public.friend_streaks
    set streak = case
          when v_row.last_both_active_day is null then 1
          when v_row.last_both_active_day = p_day - 1 then v_row.streak + 1
          else 1 -- разрыв — "пропустит один, сгорит у обоих", начинаем заново
        end,
        last_both_active_day = p_day
    where id = v_row.id
    returning to_jsonb(public.friend_streaks.*) into v_row;

    v_results := v_results || jsonb_build_array(to_jsonb(v_row));
  end loop;

  return v_results;
end;
$$;
revoke all on function public.touch_friend_streaks(date) from public, anon;
grant execute on function public.touch_friend_streaks(date) to authenticated;

-- Откат:
-- revoke all on function public.touch_friend_streaks(date) from authenticated;
-- drop function if exists public.touch_friend_streaks(date);
-- revoke all on function public.accept_friend_streak_invite(uuid) from authenticated;
-- drop function if exists public.accept_friend_streak_invite(uuid);
-- revoke all on function public.create_friend_streak_invite() from authenticated;
-- drop function if exists public.create_friend_streak_invite();
-- drop table if exists friend_streaks;
-- drop table if exists weekly_rank_snapshots;
-- drop function if exists public.get_weekly_leaderboard_for_week(date);
-- alter table duels drop column opponent_xp_awarded;
-- alter table duels drop column creator_xp_awarded;
-- alter table duels drop column invite_expires_at;
-- drop function if exists public.claim_duel_result(uuid);
-- drop function if exists public.duel_win_xp_reward();
-- alter table profiles drop column duel_win_streak;
-- (get_weekly_leaderboard()/get_duel_state(uuid) -- восстановить тела из
-- 0049/0050 вручную при откате, если нужен откат без каскада)
