#!/usr/bin/env bash
# Гонки старого приложения с миграцией 0060 на РЕАЛЬНЫХ параллельных сессиях PostgreSQL (не последовательная имитация).
#
#   PGHOST=<сокет|localhost> PGUSER=postgres PGDATABASE=<имя> supabase/tests/race_0060.sh
#
# Вызывается из run-local.sh; можно запускать и отдельно (создаёт и удаляет свои базы <имя>_race_*).
# Что проверяется — последовательность из аудита: «старое приложение прочитало xp → новый award_xp записал накопление
# (applied = false) → началась 0060 → finish_rewards_rollout перенёс накопленное → СТАРЫЙ запрос с устаревшим абсолютным
# значением пытается завершиться после переноса». Старые запросы — настоящие сессии, а состояния «заблокирован» и
# «кто кого держит» подтверждаются по pg_stat_activity / pg_blocking_pids, а не предполагаются.
#
#   S1  старые запросы (UPDATE profiles, upsert activity_days, ПОДГОТОВЛЕННЫЙ запрос с закэшированным планом) начали
#       выполняться, встали на блокировке 0060 и завершаются уже после её коммита → отклонены, перенесённое не затёрто;
#       новое начисление, пришедшее в окно миграции, тоже не теряется
#   S2  старая транзакция уже записала и держит блокировку, когда стартует 0060 → 0060 ждёт её, затем переносит ПОВЕРХ
#   S3  старая транзакция держит дольше lock_timeout → 0060 откатывается целиком (ничего не перенесено наполовину),
#       повтор после освобождения проходит
#   S4  старый UPDATE ждёт строку, которую держит новое начисление, а 0060 ждёт флаг фазы → порядок безопасен
#   S5  старая транзакция читала до 0060 и пишет после: REPEATABLE READ и READ COMMITTED
#   S6  сбой в середине переноса откатывает ВСЁ (в том числе уже выполненные шаги переноса)
#   S7  параллельные вызовы finish_rewards_rollout: перенос один раз, без удвоения
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"
M0060="$MIGRATIONS/0060_xp_rewards_lockdown.sql"
: "${PGHOST:?задай PGHOST}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=postgres}"
export PGHOST PGUSER
BASE="${PGDATABASE}_race"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
QUERY=(psql -X -q -t -A)
case "$PGHOST" in /*|localhost|127.0.0.1|::1) ;; *) echo "Отказ: хост «$PGHOST» не локальный." >&2; exit 2 ;; esac

WORK="$(mktemp -d)"
DBS=()
cleanup() {
  touch "$WORK/stop" 2>/dev/null || true
  pkill -P $$ 2>/dev/null || true
  for db in "${DBS[@]:-}"; do [ -n "$db" ] && PGDATABASE=postgres "${QUERY[@]}" -c "drop database if exists \"$db\" with (force)" >/dev/null 2>&1 || true; done
  rm -rf "$WORK"
}
trap cleanup EXIT

fail=0
check() { if [ "$2" != "$3" ]; then echo "   НЕ СОШЛОСЬ: $1 (получено «$2», ожидалось «$3»)" >&2; fail=1; else echo "   ok: $1"; fi; }
q() { PGDATABASE="$1" "${QUERY[@]}" -c "$2"; }
wait_cond() { # wait_cond <база> <sql, возвращающий t> <секунд> <описание>
  local end=$((SECONDS + $3))
  while [ "$SECONDS" -lt "$end" ]; do
    [ "$(q "$1" "$2" 2>/dev/null || true)" = "t" ] && return 0
    sleep 0.1
  done
  echo "   НЕ ДОЖДАЛИСЬ: $4" >&2; fail=1; return 0
}
blocked_by() { # SQL: сессия <app_blocked> заблокирована сессией <app_blocker>
  echo "select coalesce(bool_or(pg_blocking_pids(a.pid) @> array[b.pid]), false) from pg_stat_activity a, pg_stat_activity b where a.application_name = '$1' and b.application_name = '$2' and a.datname = current_database() and b.datname = current_database()"
}
run_bg() { # run_bg <имя-приложения> <база> <файл.sql> — фоновая сессия; код выхода и вывод — в $WORK
  local app="$1" db="$2" file="$3"
  ( set +e; PGAPPNAME="$app" PGDATABASE="$db" "${PSQL[@]}" -f "$file" > "$WORK/$app.out" 2> "$WORK/$app.err"; echo $? > "$WORK/$app.rc" ) >/dev/null 2>&1 &
}
rc_of() { cat "$WORK/$1.rc" 2>/dev/null || echo "running"; }
wait_rc() { local end=$((SECONDS + ${2:-30})); while [ ! -e "$WORK/$1.rc" ] && [ "$SECONDS" -lt "$end" ]; do sleep 0.1; done; rc_of "$1"; }
flag() { touch "$WORK/$1"; }
await_flag='while [ ! -e'   # в psql-скриптах: \! while [ ! -e FILE ]; do sleep 0.05; done

secs_to_midnight=$(( 86400 - $(date -u +%s) % 86400 ))
if [ "$secs_to_midnight" -lt 90 ]; then echo "   ждём полуночи UTC ($secs_to_midnight с): дневные строки считаются по дате UTC"; sleep $((secs_to_midnight + 2)); fi

U1=00000000-0000-0000-0000-0000000fe001
U2=00000000-0000-0000-0000-0000000fe002
U3=00000000-0000-0000-0000-0000000fe003
U4=00000000-0000-0000-0000-0000000fe004
TODAY="(now() at time zone 'UTC')::date"

# ---------- шаблонная база: фаза overlap, накоплено 30 XP у каждого, у U4 — ещё и отложенная отметка цели ----------
TPL="${BASE}_tpl"
DBS+=("$TPL")
PGDATABASE=postgres "${QUERY[@]}" -c "drop database if exists \"$TPL\" with (force)" >/dev/null
PGDATABASE=postgres "${QUERY[@]}" -c "create database \"$TPL\"" >/dev/null
PGDATABASE="$TPL" "${PSQL[@]}" -f "$HERE/local-stub.sql" >/dev/null 2>&1
for f in "$MIGRATIONS"/*.sql; do
  n="$(basename "$f")"
  [[ "$n" < "0059" ]] || [[ "$n" == 0059_* ]] || continue
  PGDATABASE="$TPL" "${PSQL[@]}" -1 -f "$f" >/dev/null 2>&1 || { echo "МИГРАЦИЯ УПАЛА: $n" >&2; exit 1; }
done
PGDATABASE="$TPL" "${PSQL[@]}" >/dev/null <<SQL
insert into auth.users (id, email) values ('$U1','r1@x.test'),('$U2','r2@x.test'),('$U3','r3@x.test'),('$U4','r4@x.test');
insert into profiles (id, target_language, native_language, xp, daily_xp_goal) values ('$U1','en','ru',1000,5000),('$U2','en','ru',1000,5000),('$U3','en','ru',1000,5000);
insert into profiles (id, target_language, native_language, xp, daily_xp_goal, daily_goal_type, daily_goal_target) values ('$U4','en','ru',1000,5000,'lessons',2);
-- то, что старое приложение успело записать до выкладки нового
insert into activity_days (user_id, day, xp, goal_met) select id, $TODAY, 5, false from profiles;
-- новое приложение в фазе overlap: три начисления по 10 XP у каждого — в журнал, счётчики не тронуты
select award_xp(p.id, 'lesson_complete', 'pre-' || g, 10, null) from profiles p, generate_series(1, 3) g;
select mark_goal_met('$U4', $TODAY);
create or replace function race_state() returns text language sql as \$\$
  select md5(concat_ws('#',
    (select string_agg(id || ':' || xp, ',' order by id) from profiles),
    (select string_agg(user_id || ':' || day || ':' || xp || ':' || goal_met, ',' order by user_id, day) from activity_days),
    (select string_agg(id || ':' || applied, ',' order by id) from xp_events),
    (select string_agg(user_id || ':' || day, ',' order by user_id, day) from pending_goal_marks),
    (select rewards_phase from rollout_state),
    (select count(*) from pg_trigger where tgname = 'profiles_guard_rewards'),
    (select count(*) from pg_policies where policyname = 'activity_days: owner full access'),
    (select pg_get_constraintdef(oid) from pg_constraint where conname = 'daily_quests_quest_type_check')))
\$\$;
SQL
check "шаблон: накоплено 12 событий (4 × 3), счётчики не тронуты, отметка цели отложена" "$(q "$TPL" "select (select count(*) from xp_events where not applied) || '/' || (select sum(xp) from profiles) || '/' || (select count(*) from pending_goal_marks)")" "12/4000/1"

new_db() { local db="${BASE}_$1"; DBS+=("$db"); PGDATABASE=postgres "${QUERY[@]}" -c "drop database if exists \"$db\" with (force)" >/dev/null; PGDATABASE=postgres "${QUERY[@]}" -c "create database \"$db\" template \"$TPL\"" >/dev/null; echo "$db"; }
final() { q "$1" "select xp from profiles where id = '$2'"; }
final_day() { q "$1" "select xp from activity_days where user_id = '$2' and day = $TODAY"; }
JWT() { echo "select set_config('request.jwt.claim.sub', '$1', false);"; }

# =====================================================================================================================
echo "== S1: старые запросы встали на блокировке 0060 и завершаются после её коммита"
DB="$(new_db s1)"
# U2: подготовленный запрос с закэшированным (generic) планом: первое выполнение — ДО миграции (проходит), второе — после её начала
cat > "$WORK/a3.sql" <<SQL
set role authenticated;
$(JWT $U2)
set plan_cache_mode = force_generic_plan;
prepare old_upd(int) as update profiles set xp = \$1 where id = '$U2';
execute old_upd(1001);
\\! touch $WORK/a3.pre
\\! i=0; while [ ! -e $WORK/go3 ] && [ \$i -lt 600 ]; do sleep 0.05; i=\$((i+1)); done
execute old_upd(1002);
SQL
run_bg old_prep "$DB" "$WORK/a3.sql"
wait_cond "$DB" "select count(*) = 1 from profiles where id = '$U2' and xp = 1001" 10 "S1: первое выполнение подготовленного запроса (до миграции)"
# F — «миграция»: перенос, затем пауза с удержанием блокировок (миграция ещё идёт), затем остальное содержимое настоящего 0060
cat > "$WORK/f1.sql" <<SQL
begin;
select finish_rewards_rollout();
\\! touch $WORK/f1.transferred
\\! i=0; while [ ! -e $WORK/release1 ] && [ \$i -lt 600 ]; do sleep 0.05; i=\$((i+1)); done
\\i $M0060
commit;
SQL
run_bg migration "$DB" "$WORK/f1.sql"
for _ in $(seq 1 200); do [ -e "$WORK/f1.transferred" ] && break; sleep 0.05; done
# транзакция миграции открыта: перенос выполнен, запреты ещё не созданы — самое опасное окно
check "S1: миграция взяла блокировку записи profiles и activity_days ДО переноса" "$(q "$DB" "select exists(select 1 from pg_locks l join pg_stat_activity a using (pid) where a.application_name = 'migration' and l.granted and l.mode = 'ShareRowExclusiveLock' and l.relation = 'profiles'::regclass) and exists(select 1 from pg_locks l join pg_stat_activity a using (pid) where a.application_name = 'migration' and l.granted and l.mode = 'ShareRowExclusiveLock' and l.relation = 'activity_days'::regclass)")" "t"
check "S1: в этом окне перенос уже выполнен внутри незакоммиченной транзакции, снаружи ещё ничего не видно" "$(q "$DB" "select (select count(*) from xp_events where not applied) || '/' || (select xp from profiles where id = '$U1')")" "12/1000"
# старые запросы стартуют, пока миграция держит блокировки
cat > "$WORK/a1.sql" <<SQL
set role authenticated;
$(JWT $U1)
update profiles set xp = 1001 where id = '$U1';
SQL
cat > "$WORK/a2.sql" <<SQL
set role authenticated;
$(JWT $U3)
insert into activity_days (user_id, day, xp, goal_met) values ('$U3', $TODAY, 6, false)
  on conflict (user_id, day) do update set xp = excluded.xp, goal_met = excluded.goal_met;
SQL
cat > "$WORK/n1.sql" <<SQL
\\pset tuples_only on
\\pset format unaligned
select award_xp('$U4', 'lesson_complete', 'in-window', 10, null)->>'status' || '/' || (award_xp('$U4', 'lesson_complete', 'in-window', 10, null)->>'status');
SQL
run_bg old_upd "$DB" "$WORK/a1.sql"
run_bg old_act "$DB" "$WORK/a2.sql"
touch "$WORK/go3"
run_bg new_award "$DB" "$WORK/n1.sql"
wait_cond "$DB" "$(blocked_by old_upd migration)" 10 "S1: старый UPDATE ждёт блокировку миграции"
wait_cond "$DB" "$(blocked_by old_act migration)" 10 "S1: старый upsert activity_days ждёт блокировку миграции"
wait_cond "$DB" "$(blocked_by old_prep migration)" 10 "S1: подготовленный запрос ждёт блокировку миграции"
wait_cond "$DB" "$(blocked_by new_award migration)" 10 "S1: новое начисление ждёт флаг фазы"
check "S1: ВОСПРОИЗВЕДЕНО — все три старых запроса и новое начисление в этот момент висят на открытой транзакции миграции" "$(q "$DB" "select (select count(*) from pg_stat_activity where application_name in ('old_upd','old_act','old_prep','new_award') and wait_event_type = 'Lock' and datname = current_database())")" "4"
check "S1: пока миграция не закоммитилась, никто из ожидающих ничего не записал" "$(q "$DB" "select xp from profiles where id = '$U1'")" "1000"
touch "$WORK/release1"
rc_f="$(wait_rc migration 40)"; check "S1: миграция завершилась успешно (без взаимной блокировки со старыми запросами)" "$rc_f" "0"
[ "$rc_f" = "0" ] || echo "   причина: $(grep -m1 ERROR "$WORK/migration.err" | sed "s/.*ERROR/ERROR/" | cut -c1-120)" >&2
for app in old_upd old_act old_prep; do wait_rc "$app" 30 >/dev/null; done; wait_rc new_award 30 >/dev/null
check "S1: старый UPDATE profiles отклонён ПОСЛЕ коммита миграции (guard)" "$(rc_of old_upd)/$(grep -c 'profile rewards are managed by the server' "$WORK/old_upd.err")" "3/1"
check "S1: старый upsert activity_days отклонён (права отозваны, запрос начал выполняться до отзыва)" "$(rc_of old_act)/$(grep -c 'permission denied for table activity_days' "$WORK/old_act.err")" "3/1"
check "S1: подготовленный запрос с закэшированным планом отклонён" "$(rc_of old_prep)/$(grep -c 'profile rewards are managed by the server' "$WORK/old_prep.err")" "3/1"
check "S1: U1 — перенос не затёрт: 1000 + 30" "$(final "$DB" $U1)" "1030"
check "S1: U1 — день: 5 + 30" "$(final_day "$DB" $U1)" "35"
check "S1: U2 — запись старого до миграции (1001) и перенос поверх: 1001 + 30" "$(final "$DB" $U2)" "1031"
check "S1: U3 — день не затёрт старым upsert: 5 + 30" "$(final_day "$DB" $U3)" "35"
check "S1: новое начисление из окна миграции выполнено уже в live и не потеряно" "$(cat "$WORK/new_award.out" | tr -d ' ')" "awarded/duplicate"
check "S1: U4 — 1000 + 30 перенос + 10 новое" "$(final "$DB" $U4)" "1040"
check "S1: U4 — день: 5 + 30 + 10" "$(final_day "$DB" $U4)" "45"
check "S1: U4 — отложенная отметка цели выставлена, очередь пуста" "$(q "$DB" "select (select goal_met from activity_days where user_id = '$U4' and day = $TODAY) || '/' || (select count(*) from pending_goal_marks) || '/' || (select count(*) from xp_events where not applied)")" "true/0/0"
rm -f "$WORK"/*.rc "$WORK"/*.out "$WORK"/*.err "$WORK"/go3 "$WORK"/f1.transferred "$WORK"/release1

# =====================================================================================================================
echo "== S2: старая транзакция УЖЕ записала и держит блокировку, когда стартует 0060"
DB="$(new_db s2)"
cat > "$WORK/a4.sql" <<SQL
begin;
set local role authenticated;
$(JWT $U1)
update profiles set xp = 1001 where id = '$U1';
insert into activity_days (user_id, day, xp, goal_met) values ('$U1', $TODAY, 6, false)
  on conflict (user_id, day) do update set xp = excluded.xp, goal_met = excluded.goal_met;
\\! touch $WORK/a4.locked
select pg_sleep(4);
commit;
SQL
run_bg old_tx "$DB" "$WORK/a4.sql"
wait_cond "$DB" "select count(*) > 0 from pg_stat_activity where application_name = 'old_tx' and state = 'active' and query like '%pg_sleep%'" 10 "S2: старая транзакция держит блокировки"
( set +e; PGAPPNAME=migration PGDATABASE="$DB" "${PSQL[@]}" -1 -f "$M0060" > "$WORK/migration.out" 2> "$WORK/migration.err"; echo $? > "$WORK/migration.rc" ) >/dev/null 2>&1 &
wait_cond "$DB" "$(blocked_by migration old_tx)" 10 "S2: 0060 ждёт старую транзакцию"
check "S2: ВОСПРОИЗВЕДЕНО — 0060 стоит на блокировке старой транзакции (не перенесла и не ломает её запись)" "$(q "$DB" "select count(*) from pg_stat_activity where application_name = 'migration' and wait_event_type = 'Lock'")" "1"
check "S2: до коммита старой транзакции перенос не начат" "$(q "$DB" "select count(*) from xp_events where not applied")" "12"
check "S2: старая транзакция успешно завершилась" "$(wait_rc old_tx 30)" "0"
check "S2: миграция завершилась после неё" "$(wait_rc migration 30)" "0"
check "S2: U1 — запись старого (1001) НЕ потеряна и перенос (30) поверх неё" "$(final "$DB" $U1)" "1031"
check "S2: U1 — день: запись старого (6) + перенос (30)" "$(final_day "$DB" $U1)" "36"
check "S2: фаза live, очередь пуста" "$(q "$DB" "select rewards_phase() || '/' || (select count(*) from xp_events where not applied)")" "live/0"
rm -f "$WORK"/*.rc "$WORK"/*.out "$WORK"/*.err "$WORK"/*.locked

# =====================================================================================================================
echo "== S3: старая транзакция держит дольше lock_timeout — 0060 откатывается целиком"
DB="$(new_db s3)"
cat > "$WORK/a5.sql" <<SQL
begin;
set local role authenticated;
$(JWT $U1)
update profiles set xp = 1001 where id = '$U1';
\\! touch $WORK/a5.locked
select pg_sleep(14);
commit;
SQL
run_bg old_tx "$DB" "$WORK/a5.sql"
wait_cond "$DB" "select count(*) > 0 from pg_stat_activity where application_name = 'old_tx' and state = 'active' and query like '%pg_sleep%'" 10 "S3: старая транзакция держит блокировку"
BEFORE="$(q "$DB" "select race_state()")"
start=$SECONDS
( set +e; PGAPPNAME=migration PGDATABASE="$DB" "${PSQL[@]}" -1 -f "$M0060" > "$WORK/migration.out" 2> "$WORK/migration.err"; echo $? > "$WORK/migration.rc" ) >/dev/null 2>&1 &
rc_f="$(wait_rc migration 30)"; waited=$((SECONDS - start))
check "S3: 0060 завершилась ОШИБКОЙ по таймауту блокировки" "$rc_f/$(grep -c 'lock timeout' "$WORK/migration.err")" "3/1"
check "S3: ждала примерно lock_timeout (10 с), а не вечно: 9–13 с" "$([ "$waited" -ge 9 ] && [ "$waited" -le 13 ] && echo yes || echo "no($waited)")" "yes"
check "S3: после отказа ничего не изменилось: ни XP, ни дни, ни события, ни отметки, ни фаза, ни триггер, ни политики, ни check" "$(q "$DB" "select race_state()")" "$BEFORE"
check "S3: фаза всё ещё overlap, 12 событий ждут" "$(q "$DB" "select rewards_phase() || '/' || (select count(*) from xp_events where not applied)")" "overlap/12"
check "S3: старая транзакция завершилась успешно" "$(wait_rc old_tx 30)" "0"
rm -f "$WORK/migration.rc" "$WORK/migration.out" "$WORK/migration.err"
PGDATABASE="$DB" "${PSQL[@]}" -1 -f "$M0060" >/dev/null 2>&1 || { echo "   НЕ СОШЛОСЬ: S3: повтор 0060 не прошёл" >&2; fail=1; }
check "S3: повтор 0060 после освобождения проходит; запись старого (1001) + перенос (30)" "$(final "$DB" $U1)" "1031"
check "S3: фаза live" "$(q "$DB" "select rewards_phase()")" "live"
rm -f "$WORK"/*.rc "$WORK"/*.out "$WORK"/*.err "$WORK"/*.locked

# =====================================================================================================================
echo "== S4: старый UPDATE ждёт строку, которую держит новое начисление; 0060 ждёт флаг фазы"
DB="$(new_db s4)"
cat > "$WORK/n2.sql" <<SQL
begin;
select award_xp('$U1', 'lesson_complete', 'held', 10, null)->>'status';
\\! touch $WORK/n2.held
select pg_sleep(5);
commit;
SQL
run_bg new_tx "$DB" "$WORK/n2.sql"
wait_cond "$DB" "select count(*) > 0 from pg_stat_activity where application_name = 'new_tx' and state = 'active' and query like '%pg_sleep%'" 10 "S4: новое начисление держит строку профиля и флаг"
cat > "$WORK/a6.sql" <<SQL
set role authenticated;
$(JWT $U1)
update profiles set xp = 1001 where id = '$U1';
SQL
run_bg old_upd "$DB" "$WORK/a6.sql"
wait_cond "$DB" "$(blocked_by old_upd new_tx)" 10 "S4: старый UPDATE ждёт строку, занятую новым начислением"
( set +e; PGAPPNAME=migration PGDATABASE="$DB" "${PSQL[@]}" -1 -f "$M0060" > "$WORK/migration.out" 2> "$WORK/migration.err"; echo $? > "$WORK/migration.rc" ) >/dev/null 2>&1 &
wait_cond "$DB" "select exists(select 1 from pg_stat_activity where application_name = 'migration' and wait_event_type = 'Lock')" 10 "S4: 0060 ждёт"
check "S4: ВОСПРОИЗВЕДЕНО — старый UPDATE (держит блокировку таблицы, ждёт строку) и 0060 (ждёт флаг/таблицу) одновременно" "$(q "$DB" "select count(*) from pg_stat_activity where application_name in ('old_upd','migration') and wait_event_type = 'Lock' and datname = current_database()")" "2"
check "S4: новое начисление завершилось" "$(wait_rc new_tx 30)" "0"
check "S4: старый UPDATE успел записать до миграции (получил строку первым)" "$(wait_rc old_upd 30)" "0"
check "S4: миграция завершилась" "$(wait_rc migration 30)" "0"
check "S4: U1 — запись старого (1001) + перенос (30 + 10 новое начисление в окне)" "$(final "$DB" $U1)" "1041"
check "S4: U1 — день: 5 + 40" "$(final_day "$DB" $U1)" "45"
check "S4: очередь пуста, фаза live" "$(q "$DB" "select rewards_phase() || '/' || (select count(*) from xp_events where not applied)")" "live/0"
rm -f "$WORK"/*.rc "$WORK"/*.out "$WORK"/*.err

# =====================================================================================================================
echo "== S5: старая транзакция читала до 0060, а пишет после (REPEATABLE READ и READ COMMITTED)"
DB="$(new_db s5)"
cat > "$WORK/rr.sql" <<SQL
begin isolation level repeatable read;
set local role authenticated;
$(JWT $U1)
select xp from profiles where id = '$U1';
\\! touch $WORK/rr.read
\\! i=0; while [ ! -e $WORK/go5 ] && [ \$i -lt 600 ]; do sleep 0.05; i=\$((i+1)); done
update profiles set xp = 1001 where id = '$U1';
commit;
SQL
cat > "$WORK/rc.sql" <<SQL
begin;
set local role authenticated;
$(JWT $U2)
select xp from profiles where id = '$U2';
\\! touch $WORK/rc.read
\\! i=0; while [ ! -e $WORK/go5 ] && [ \$i -lt 600 ]; do sleep 0.05; i=\$((i+1)); done
update profiles set xp = 1001 where id = '$U2';
commit;
SQL
run_bg old_rr "$DB" "$WORK/rr.sql"
run_bg old_rc "$DB" "$WORK/rc.sql"
for _ in $(seq 1 200); do [ -e "$WORK/rr.read" ] && [ -e "$WORK/rc.read" ] && break; sleep 0.05; done
PGDATABASE="$DB" "${PSQL[@]}" -1 -f "$M0060" >/dev/null 2>&1 || { echo "   НЕ СОШЛОСЬ: S5: 0060 не применилась" >&2; fail=1; }
touch "$WORK/go5"
check "S5: REPEATABLE READ — запись по устаревшему снимку отклонена (ошибка сериализации или guard)" "$(wait_rc old_rr 30)/$(grep -cE 'could not serialize access|profile rewards are managed by the server' "$WORK/old_rr.err")" "3/1"
check "S5: READ COMMITTED — запись по устаревшему чтению отклонена guard-ом" "$(wait_rc old_rc 30)/$(grep -c 'profile rewards are managed by the server' "$WORK/old_rc.err")" "3/1"
check "S5: U1 и U2 — перенесённое на месте (1030, 1030)" "$(final "$DB" $U1)/$(final "$DB" $U2)" "1030/1030"
rm -f "$WORK"/*.rc "$WORK"/*.out "$WORK"/*.err "$WORK"/go5 "$WORK"/*.read

# =====================================================================================================================
echo "== S6: сбой в середине переноса откатывает всё"
DB="$(new_db s6)"
BEFORE="$(q "$DB" "select race_state()")"
for victim in "rollout_state:update" "pending_goal_marks:delete" "xp_events:update"; do
  tbl="${victim%%:*}"; op="${victim##*:}"
  PGDATABASE="$DB" "${PSQL[@]}" >/dev/null <<SQL
create function boom() returns trigger language plpgsql as \$\$ begin raise exception 'boom in $tbl'; end \$\$;
create trigger boom_t before $op on $tbl for each row execute function boom();
SQL
  res="$(PGDATABASE="$DB" "${QUERY[@]}" -c "do \$\$ begin begin perform finish_rewards_rollout(); raise exception 'NOT FAILED'; exception when others then if sqlerrm <> 'boom in $tbl' then raise; end if; end; end \$\$; select 'caught'" 2>&1 | tail -1)"
  check "S6: сбой на шаге «$op $tbl» перехвачен" "$res" "caught"
  check "S6: после сбоя «$op $tbl» нет частично перенесённого (счётчики, дни, события, отметки, фаза — как до вызова)" "$(q "$DB" "select race_state()")" "$BEFORE"
  PGDATABASE="$DB" "${PSQL[@]}" >/dev/null <<SQL
drop trigger boom_t on $tbl; drop function boom();
SQL
done
# сбой в миграции целиком (файл 0060 в транзакции): создание триггера падает уже ПОСЛЕ переноса
if PGDATABASE="$DB" "${PSQL[@]}" -1 -c "select 1" -f "$M0060" -c "select 1/0" >/dev/null 2>"$WORK/mig.err"; then echo "   НЕ СОШЛОСЬ: S6: транзакция с ошибкой после 0060 не откатилась" >&2; fail=1; fi
check "S6: ошибка ПОСЛЕ успешной 0060 в той же транзакции откатывает и перенос, и запреты" "$(q "$DB" "select race_state()")" "$BEFORE"
check "S6: фаза overlap, события не применены" "$(q "$DB" "select rewards_phase() || '/' || (select count(*) from xp_events where not applied) || '/' || (select sum(xp) from profiles)")" "overlap/12/4000"

# =====================================================================================================================
echo "== S7: параллельные вызовы finish_rewards_rollout — перенос один раз"
DB="$(new_db s7)"
for i in 1 2 3 4 5 6; do
  ( set +e; PGAPPNAME="fin$i" PGDATABASE="$DB" "${QUERY[@]}" -c "select finish_rewards_rollout()->>'status'" > "$WORK/fin$i.out" 2>&1 ) >/dev/null 2>&1 &
done
wait
check "S7: ровно один вызов перенёс, остальные — already_live" "$(cat "$WORK"/fin?.out | sort | uniq -c | tr -s ' ' | tr '\n' ';')" " 5 already_live; 1 finished;"
check "S7: суммы без удвоения: 4000 + 4 × 30 = 4120" "$(q "$DB" "select sum(xp) from profiles")" "4120"
check "S7: дни без удвоения: 4 × 5 + 4 × 30 = 140" "$(q "$DB" "select sum(xp) from activity_days")" "140"
check "S7: очередь пуста, отметка цели выставлена один раз" "$(q "$DB" "select (select count(*) from xp_events where not applied) || '/' || (select count(*) from pending_goal_marks) || '/' || (select goal_met from activity_days where user_id = '$U4' and day = $TODAY)")" "0/0/true"
# повторный вызов позже ничего не меняет
AFTER="$(q "$DB" "select race_state()")"
q "$DB" "select finish_rewards_rollout()" >/dev/null
check "S7: ещё один вызов позже — полный no-op" "$(q "$DB" "select race_state()")" "$AFTER"

if [ "$fail" -ne 0 ]; then echo "ГОНКИ 0060: ПРОВЕРКИ НЕ ПРОЙДЕНЫ" >&2; exit 1; fi
echo "ГОНКИ 0060: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ"
