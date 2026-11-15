import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Миграции итерации 6 выкладываются в два шага (expand → деплой нового приложения → contract), и
// порядок держится на том, что в каждой — только своё. Эти проверки читают текст SQL и ловят
// случайный «переезд» запрещающего оператора в expand (он сломал бы старое приложение до деплоя)
// или аддитивного — в contract. Это страховка от правок, а не проверка поведения: поведение
// проверяет supabase/tests/run-local.sh на временном PostgreSQL.

const dir = resolve(import.meta.dirname, "../../supabase/migrations");
const strip = (sql: string) => sql.replace(/--[^\n]*/g, "");
const expand = strip(readFileSync(resolve(dir, "0059_xp_ledger_goals_timezone.sql"), "utf8"));
const contract = strip(readFileSync(resolve(dir, "0060_xp_rewards_lockdown.sql"), "utf8"));

test("expand (0059) ничего не отбирает у существующих ролей и таблиц", () => {
  // права клиентской роли на существующие таблицы не отзываются
  assert.doesNotMatch(expand, /revoke\s+(insert|update|delete|all)[^;]*\bon\s+(activity_days|user_achievements|profiles|daily_quests)\b/i);
  // политики существующих таблиц не удаляются и не заменяются
  assert.doesNotMatch(expand, /drop\s+policy[^;]*\bon\s+(activity_days|user_achievements|profiles)\b/i);
  assert.doesNotMatch(expand, /create\s+policy[^;]*\bon\s+(activity_days|user_achievements|profiles)\b/i);
  // триггеры, запрещающие клиентскую запись наград, — только в contract
  assert.doesNotMatch(expand, /profiles_guard_rewards/);
  assert.doesNotMatch(expand, /timezone_changed_at\s+is\s+distinct\s+from\s+old/i);
  // существующие колонки не удаляются и не переименовываются
  assert.doesNotMatch(expand, /drop\s+column|rename\s+(column|to)/i);
  // новые колонки profiles — только необязательные или с default
  for (const m of expand.matchAll(/alter\s+table\s+profiles\s+add\s+column\s+(\w+)\s+([^;]*);/gi)) {
    assert.ok(!/not\s+null/i.test(m[2]) || /default/i.test(m[2]), `profiles.${m[1]}: NOT NULL без default сломал бы вставки старого приложения`);
  }
});

test("expand (0059) содержит всё, что нужно новому коду", () => {
  for (const needle of [
    "alter table profiles add column timezone ",
    "add column timezone_changed_at",
    "add column daily_goal_type",
    "create table xp_events",
    "function public.award_xp(",
    "function public.mark_goal_met(",
    "profiles_guard_timezone",
    "grant select, insert, update on activity_days to service_role",
    "grant select, insert on user_achievements to service_role",
    "lesson_attempts_user_completed_idx",
    "create table rollout_state",
    "function public.rewards_phase(",
    "create table pending_goal_marks",
    "function public.finish_rewards_rollout(",
    "applied boolean not null default true",
  ]) assert.ok(expand.includes(needle), needle);
  // check на типы заданий в expand НЕ расширяется: старый интерфейс не отобразит новые типы (расширяет 0060)
  assert.doesNotMatch(expand, /daily_quests_quest_type_check/);
  for (const type of ["earn_xp", "complete_lessons", "answer_exercises"]) assert.ok(!expand.includes(`'${type}'`), `${type} появляется только в contract`);
});

test("барьер выкладки: в фазе overlap award_xp / mark_goal_met не пишут счётчики старого кода", () => {
  const award = expand.slice(expand.indexOf("function public.award_xp("), expand.indexOf("function public.mark_goal_met("));
  const deferredStart = award.search(/if v_deferred then\s+select v_profile\.xp/);
  const deferredBranch = award.slice(deferredStart, award.indexOf("  else\n    insert into public.xp_events (user_id, source, ref, base_amount, amount, boosted, day)\n"));
  assert.ok(deferredBranch.length > 200, "ветка отложенного начисления найдена");
  assert.match(deferredBranch, /insert into public\.xp_events[\s\S]*applied\)[\s\S]*false\)/, "событие пишется как неприменённое");
  assert.doesNotMatch(deferredBranch, /update\s+public\.profiles|insert\s+into\s+public\.activity_days|update\s+public\.activity_days/i, "счётчики в ветке overlap не пишутся");
  const mark = expand.slice(expand.indexOf("function public.mark_goal_met("), expand.indexOf("-- ---------- 6. часовой пояс"));
  const markDeferred = mark.slice(mark.indexOf("if coalesce(v_phase, 'overlap') <> 'live' then"), mark.indexOf("insert into public.activity_days as ad"));
  assert.ok(markDeferred.includes("pending_goal_marks"), "отметка откладывается");
  assert.doesNotMatch(markDeferred, /insert\s+into\s+public\.activity_days|update\s+public\.activity_days/i);
  // день в overlap — UTC, как у старого кода
  assert.match(award, /if v_deferred then\s+v_day := \(now\(\) at time zone 'UTC'\)::date;/);
});

test("порядок блокировок один во всех функциях барьера: флаг → профиль → activity_days (иначе возможна взаимная блокировка)", () => {
  const award = expand.slice(expand.indexOf("function public.award_xp("), expand.indexOf("function public.mark_goal_met("));
  const flag = award.indexOf("from public.rollout_state for share");
  const profile = award.indexOf("from public.profiles\n   where id = p_user\n   for update");
  const day = award.indexOf("insert into public.activity_days as ad");
  assert.ok(flag > 0 && profile > flag && day > profile, "award_xp: флаг (share) → профиль (update) → activity_days");
  const mark = expand.slice(expand.indexOf("function public.mark_goal_met("), expand.indexOf("-- ---------- 6. часовой пояс"));
  assert.ok(mark.indexOf("from public.rollout_state for share") < mark.indexOf("from public.profiles where id = p_user"), "mark_goal_met: флаг раньше профиля");
  const finish = expand.slice(expand.indexOf("function public.finish_rewards_rollout("));
  const finishFlag = finish.indexOf("from public.rollout_state for update");
  const finishLock = finish.indexOf("lock table public.profiles, public.activity_days in share row exclusive mode");
  const finishApply = finish.indexOf("update public.profiles p");
  assert.ok(finishFlag > 0 && finishLock > finishFlag && finishApply > finishLock, "finish: флаг (update) → блокировка таблиц → перенос");
  assert.match(finish, /set_config\('lock_timeout', '10s', true\)/, "ожидание блокировок ограничено — при неудаче откатывается всё");
  // перенос заканчивается включением live, и повторный вызов — no-op
  assert.match(finish, /if v_phase = 'live' then\s+return jsonb_build_object\('status', 'already_live'\)/);
  assert.match(finish, /update public\.rollout_state set rewards_phase = 'live'/);
  // клиентской роли функции переноса недоступны
  assert.match(expand, /revoke all on function public\.finish_rewards_rollout\(\) from public, anon, authenticated/);
  assert.match(expand, /revoke all on rollout_state from anon, authenticated/);
  assert.match(expand, /revoke all on pending_goal_marks from anon, authenticated/);
});

test("пауза часового пояса на уровне базы: пока overlap, клиентская смена отклоняется", () => {
  assert.match(expand, /if public\.rewards_phase\(\) <> 'live' then\s+raise exception using errcode = '55000', message = 'timezone_sync_paused';/);
});

test("антидребезг пояса: час, первая установка не ограничена и не ставит отметку", () => {
  assert.match(expand, /interval '1 hour'/);
  assert.doesNotMatch(expand, /interval '24 hours'[^;]*timezone_changed_at|timezone_changed_at[^;]*interval '24 hours'/i);
  // отметка ставится только внутри ветки «пояс уже был»
  assert.match(expand, /if old\.timezone is not null then[\s\S]*?new\.timezone_changed_at := now\(\);[\s\S]*?end if;/);
});

test("contract (0060) содержит запрещающую часть и проверку порядка, и ничего аддитивного", () => {
  for (const needle of [
    "profiles_guard_rewards",
    "drop policy if exists \"activity_days: owner full access\"",
    "revoke insert, update, delete on activity_days from authenticated",
    "drop policy if exists \"user_achievements: owner insert\"",
    "revoke insert on user_achievements from authenticated",
    "apply 0059 (expand) first",
    "public.finish_rewards_rollout()",
    "'earn_xp', 'complete_lessons', 'answer_exercises'",
  ]) assert.ok(contract.includes(needle), needle);
  assert.doesNotMatch(contract, /create\s+table|add\s+column|create\s+index|function\s+public\.(award_xp|mark_goal_met)/i);
});

test("contract (0060): перенос и все запреты — ОДИН оператор DO, перенос идёт первым", () => {
  const block = contract.slice(contract.indexOf("do $contract$"), contract.indexOf("$contract$;", contract.indexOf("do $contract$") + 12));
  assert.ok(block.length > 300, "блок найден");
  const finish = block.indexOf("perform public.finish_rewards_rollout()");
  for (const later of ["create trigger profiles_guard_rewards", "drop policy if exists \"activity_days: owner full access\"", "revoke insert, update, delete on activity_days from authenticated", "revoke insert on user_achievements from authenticated", "add constraint daily_quests_quest_type_check"]) {
    const at = block.indexOf(later);
    assert.ok(finish >= 0 && at > finish, `${later} — после переноса и внутри одного оператора`);
  }
  // вне блока нет ничего, что запрещало бы запись (иначе запрет мог бы выполниться без переноса)
  const outside = contract.replace(block, "");
  assert.doesNotMatch(outside, /create\s+trigger|drop\s+policy|revoke\s|add\s+constraint/i);
});

test("порядок файлов: contract идёт строго после expand", () => {
  const names = ["0059_xp_ledger_goals_timezone.sql", "0060_xp_rewards_lockdown.sql"];
  assert.ok(names[0] < names[1]);
});
