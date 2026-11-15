#!/usr/bin/env bash
# Проверка миграций и SQL-логики на ВРЕМЕННОМ локальном PostgreSQL (не Supabase, не production).
#
#   PGHOST=/path/to/socket-dir-or-localhost PGUSER=postgres PGDATABASE=lexreader_tmp supabase/tests/run-local.sh
#
# Что делает (expand / contract + барьер выкладки, итерация 6):
#   БАЗА 1 — путь выкладки с существующими данными:
#     заглушка Supabase → миграции 0001–0058 → «старые» данные (legacy_seed.sql, снимок) →
#     0060 без 0059 должна отказать → 0059 (EXPAND), данные не изменились →
#     фаза overlap: старое приложение работает, новое откладывает начисления (барьер), сценарии
#     «старый читает → новый начисляет → старый пишет устаревшее» →
#     параллельно: старый RMW-писатель × параллельные award_xp → снимок «до» →
#     0060 (CONTRACT): перенос накопленного, данные не изменились, «после = до + накопленное» по модели →
#     функции (live), что отклоняется у старого приложения, защита записи наград → параллельные вызовы.
#   БАЗА 2 (<имя>_full) — все миграции подряд (как при supabase db reset): функции, пояс, защита, фаза live.
#   БАЗА 3 (<имя>_flip) — миграции до 0059, затем 0060 применяется ПОД НАГРУЗКОЙ: пока идут старые
#     RMW-записи и параллельные начисления, ни одно начисление не теряется и не задваивается.
#   БАЗА 4 (<имя>_race_*) — race_0060.sh: старый запрос начал выполняться до 0060 и завершается после неё.
# Ставит роли и схемы auth/storage, поэтому отказывается работать с непустой базой и с не локальным хостом.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"
: "${PGHOST:?задай PGHOST (каталог сокета или localhost)}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=postgres}"
export PGHOST PGUSER PGDATABASE
MAIN_DB="$PGDATABASE"
FULL_DB="${MAIN_DB}_full"
FLIP_DB="${MAIN_DB}_flip"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
QUERY=(psql -X -q -t -A)

case "$PGHOST" in
  /*|localhost|127.0.0.1|::1) ;;
  *) echo "Отказ: хост «$PGHOST» не локальный. Скрипт только для временной локальной базы." >&2; exit 2 ;;
esac
is_empty() {
  [ "$(PGDATABASE="$1" "${QUERY[@]}" -c "select count(*) from information_schema.schemata where schema_name in ('auth','storage')")" = "0" ] &&
  [ "$(PGDATABASE="$1" "${QUERY[@]}" -c "select count(*) from information_schema.tables where table_schema='public'")" = "0" ]
}
if ! is_empty "$MAIN_DB"; then
  echo "Отказ: база «$MAIN_DB» не пустая (есть схемы auth/storage или таблицы public)." >&2
  exit 2
fi
for extra in "$FULL_DB" "$FLIP_DB"; do
  if [ "$(PGDATABASE=postgres "${QUERY[@]}" -c "select count(*) from pg_database where datname='$extra'")" != "0" ]; then
    echo "Отказ: база «$extra» уже существует." >&2
    exit 2
  fi
done
WORK="$(mktemp -d)"
cleanup() {
  touch "$WORK/stop" 2>/dev/null || true
  PGDATABASE=postgres "${QUERY[@]}" -c "drop database if exists \"$FULL_DB\"" >/dev/null 2>&1 || true
  PGDATABASE=postgres "${QUERY[@]}" -c "drop database if exists \"$FLIP_DB\"" >/dev/null 2>&1 || true
  rm -f /tmp/par_?.$$; rm -rf "$WORK"
}
trap cleanup EXIT

migrate() { # migrate <база> <шаблон-имени-файла>…  (применяет подходящие файлы по порядку, каждый в транзакции)
  local db="$1"; shift
  local count=0 f
  for f in "$MIGRATIONS"/*.sql; do
    local n; n="$(basename "$f")"
    local ok=1
    for rule in "$@"; do
      case "$rule" in
        "<0059") [[ "$n" < "0059" ]] || ok=0 ;;
        "all") ;;
        *) [[ "$n" == $rule ]] || ok=0 ;;
      esac
    done
    [ "$ok" = 1 ] || continue
    PGDATABASE="$db" "${PSQL[@]}" -1 -f "$f" >/dev/null || { echo "МИГРАЦИЯ УПАЛА: $n" >&2; exit 1; }
    count=$((count + 1))
  done
  echo "   применено в $db: $count"
}
suite() { # suite <база> <файл>
  local out
  if ! out=$(PGDATABASE="$1" "${PSQL[@]}" -f "$HERE/$2" 2>&1); then
    echo "$out" | grep -E "ERROR|ASSERT|LEGACY|CONTEXT" >&2 || echo "$out" >&2
    echo "НАБОР НЕ ПРОЙДЕН: $2" >&2
    exit 1
  fi
  echo "$out" | grep -E "PASSED|LOADED|SNAPSHOT" | sed 's/^/   /'
}
sql() { PGDATABASE="$1" "${PSQL[@]}" -c "$2" >/dev/null; }

echo "== БАЗА 1: путь выкладки с существующими данными"
"${PSQL[@]}" -f "$HERE/local-stub.sql" >/dev/null
echo "-- миграции до 0059 (состояние production до итерации 6)"
migrate "$MAIN_DB" "<0059"
suite "$MAIN_DB" legacy_seed.sql
sql "$MAIN_DB" "select legacy_check.take('pre_expand')"

echo "-- защита порядка: 0060 без 0059 отклоняется"
if "${PSQL[@]}" -1 -f "$MIGRATIONS/0060_xp_rewards_lockdown.sql" >/dev/null 2>/tmp/order.$$; then
  echo "0060 применилась без 0059" >&2; exit 1
fi
grep -q "apply 0059" /tmp/order.$$ && echo "   ok: 0060 без 0059 отказала" || { echo "нет сообщения о порядке" >&2; cat /tmp/order.$$ >&2; exit 1; }
rm -f /tmp/order.$$

echo "-- 0059 EXPAND (фаза overlap: живы старые инстансы)"
PGDATABASE="$MAIN_DB" "${PSQL[@]}" -1 -f "$MIGRATIONS/0059_xp_ledger_goals_timezone.sql" >/dev/null
sql "$MAIN_DB" "select legacy_check.assert_same('pre_expand')"; echo "   ok: существующие данные не изменились"
for s in 0059_expand_compat.sql 0059_rollout_fence.sql; do suite "$MAIN_DB" "$s"; done

echo "-- overlap: старый RMW-писатель × параллельные начисления нового кода"
export PGDATABASE="$MAIN_DB"
K=00000000-0000-0000-0000-0000000fb001
"${QUERY[@]}" -c "insert into auth.users (id,email) values ('$K','k@x.test'); insert into profiles (id,target_language,native_language,xp,daily_xp_goal) values ('$K','en','ru',1000,5000);"
(
  for i in $(seq 1 25); do
    r=$("${QUERY[@]}" -c "select old_read('$K')"); d=$("${QUERY[@]}" -c "select old_read_day('$K')")
    "${QUERY[@]}" -c "select old_write('$K', $r, $d, 1)" >/dev/null
  done
) &
OLD_PID=$!
seq 1 40 | xargs -P 10 -I{} "${QUERY[@]}" -c "select award_xp('$K','lesson_complete','par-{}',3,null)->>'status'" > /tmp/par_f.$$
wait "$OLD_PID"
fail=0
check() { if [ "$2" != "$3" ]; then echo "   НЕ СОШЛОСЬ: $1 (получено «$2», ожидалось «$3»)" >&2; fail=1; else echo "   ok: $1"; fi; }
check "40 параллельных начислений → все записаны в журнал" "$(grep -c '^awarded$' /tmp/par_f.$$)" "40"
check "счётчик — только то, что писал старый код (1000 + 25), новые его не трогали" "$("${QUERY[@]}" -c "select xp from profiles where id='$K'")" "1025"
check "накоплено в журнале ровно 40 × 3 = 120" "$("${QUERY[@]}" -c "select coalesce(sum(amount),0) from xp_events where user_id='$K' and not applied")" "120"
check "строка дня: только запись старого кода (25)" "$("${QUERY[@]}" -c "select xp from activity_days where user_id='$K' and day=(now() at time zone 'UTC')::date")" "25"
[ "$fail" -eq 0 ] || { echo "ПРОВЕРКИ НЕ ПРОЙДЕНЫ" >&2; exit 1; }
rm -f /tmp/par_f.$$

echo "-- снимок «до» и 0060 CONTRACT (перенос накопленного + запреты)"
suite "$MAIN_DB" 0060_before_apply.sql
sql "$MAIN_DB" "select legacy_check.take('pre_contract')"
PGDATABASE="$MAIN_DB" "${PSQL[@]}" -1 -f "$MIGRATIONS/0060_xp_rewards_lockdown.sql" >/dev/null
sql "$MAIN_DB" "select legacy_check.assert_same('pre_contract')"; echo "   ok: данные пользователей без накопления не изменились"
suite "$MAIN_DB" 0060_rollout_apply.sql
echo "-- функции в фазе live"
for s in 0059_functions_xp.sql 0059_functions_goals.sql 0059_timezone_policy.sql; do suite "$MAIN_DB" "$s"; done
for s in 0060_contract_compat.sql 0060_contract_guards.sql 0060_duel_streak.sql; do suite "$MAIN_DB" "$s"; done

echo "== параллельные вызовы (после contract)"
U=00000000-0000-0000-0000-0000000000c3
"${QUERY[@]}" -c "insert into auth.users (id,email) values ('$U','c@x.test'); insert into profiles (id,target_language,native_language) values ('$U','en','ru');"
seq 1 12 | xargs -P 12 -I{} "${QUERY[@]}" -c "select award_xp('$U','quest_chest','2026-11-14',30,null)->>'status'" > /tmp/par_a.$$
check "один ключ ×12 → ровно одно начисление" "$(grep -c '^awarded$' /tmp/par_a.$$)" "1"
seq 1 30 | xargs -P 15 -I{} "${QUERY[@]}" -c "select award_xp('$U','word_saved','w-{}',2,null)->>'status'" > /tmp/par_b.$$
check "30 разных ключей → нет потерянных обновлений XP" "$("${QUERY[@]}" -c "select xp from profiles where id='$U'")" "90"
seq 1 20 | xargs -P 20 -I{} "${QUERY[@]}" -c "select award_xp('$U','review_card','rc-{}',1,5)->>'status'" > /tmp/par_c.$$
check "гонка дневного лимита (20 вызовов, лимит 5)" "$(grep -c '^awarded$' /tmp/par_c.$$)" "5"
check "сумма журнала = profiles.xp = activity_days.xp" "$("${QUERY[@]}" -c "select (select sum(amount) from xp_events where user_id='$U')||'/'||(select xp from profiles where id='$U')||'/'||(select sum(xp) from activity_days where user_id='$U')")" "95/95/95"
G=00000000-0000-0000-0000-0000000000c4
"${QUERY[@]}" -c "insert into auth.users (id,email) values ('$G','g@x.test'); insert into profiles (id,target_language,native_language,daily_goal_type,daily_goal_target) values ('$G','en','ru','lessons',2);"
seq 1 16 | xargs -P 16 -I{} "${QUERY[@]}" -c "select mark_goal_met('$G', (now() at time zone 'UTC')::date)" > /tmp/par_d.$$
check "mark_goal_met ×16 → ровно одному true" "$(grep -c '^t$' /tmp/par_d.$$)" "1"
# антидребезг пояса: 8 параллельных смен клиентом — проходит одна
T=00000000-0000-0000-0000-0000000000c5
"${QUERY[@]}" -c "insert into auth.users (id,email) values ('$T','t@x.test'); insert into profiles (id,target_language,native_language,timezone,timezone_changed_at) values ('$T','en','ru','UTC', now() - interval '3 hours');"
seq 1 8 | xargs -P 8 -I{} "${QUERY[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','$T', false); update profiles set timezone = (array['Europe/Moscow','Asia/Tokyo','America/New_York','Europe/Paris','Asia/Dubai','Asia/Seoul','Europe/Rome','Africa/Cairo'])[{}] where id='$T'" > /tmp/par_e.$$ 2>&1 || true
check "смена пояса ×8 параллельно → прошла ровно одна" "$(grep -c 'timezone_change_too_frequent' /tmp/par_e.$$)" "7"
rm -f /tmp/par_?.$$
unset PGDATABASE; export PGDATABASE="$MAIN_DB"

echo "== БАЗА 2 ($FULL_DB): все миграции подряд, как при supabase db reset"
PGDATABASE=postgres "${QUERY[@]}" -c "create database \"$FULL_DB\"" >/dev/null
PGDATABASE="$FULL_DB" "${PSQL[@]}" -f "$HERE/local-stub.sql" >/dev/null
migrate "$FULL_DB" all
check "после полного прогона фаза live, накопленного нет" "$(PGDATABASE="$FULL_DB" "${QUERY[@]}" -c "select public.rewards_phase() || '/' || (select count(*) from xp_events where not applied) || '/' || (select count(*) from pending_goal_marks)")" "live/0/0"
for s in 0059_functions_xp.sql 0059_functions_goals.sql 0059_timezone_policy.sql 0060_contract_guards.sql 0060_duel_streak.sql; do suite "$FULL_DB" "$s"; done
suite "$FULL_DB" live_stale_write_control.sql

echo "== БАЗА 3 ($FLIP_DB): 0060 применяется ПОД НАГРУЗКОЙ (старые RMW-писатели × параллельные начисления)"
# не запускаем на стыке суток UTC: дневные строки считаются по дате UTC
secs_to_midnight=$(( 86400 - $(date -u +%s) % 86400 ))
if [ "$secs_to_midnight" -lt 40 ]; then echo "   ждём полуночи UTC ($secs_to_midnight с)"; sleep $((secs_to_midnight + 2)); fi
PGDATABASE=postgres "${QUERY[@]}" -c "create database \"$FLIP_DB\"" >/dev/null
PGDATABASE="$FLIP_DB" "${PSQL[@]}" -f "$HERE/local-stub.sql" >/dev/null
migrate "$FLIP_DB" "<0059"
PGDATABASE="$FLIP_DB" "${PSQL[@]}" -1 -f "$MIGRATIONS/0059_xp_ledger_goals_timezone.sql" >/dev/null
PGDATABASE="$FLIP_DB" "${PSQL[@]}" -f "$HERE/old_app.sql" >/dev/null
USERS=6
for n in $(seq 1 $USERS); do
  u="00000000-0000-0000-0000-0000000fc00$n"
  PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "insert into auth.users (id,email) values ('$u','f$n@x.test'); insert into profiles (id,target_language,native_language,xp,daily_xp_goal) values ('$u','en','ru',1000,5000);"
done
old_writer() { # old_writer <user> — последовательный старый addXp, пока не остановят или не отклонят (после 0060)
  local u="$1" ok=0 r d
  while [ ! -e "$WORK/stop" ]; do
    r=$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select old_read('$u')" 2>/dev/null) || continue
    d=$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select old_read_day('$u')" 2>/dev/null) || continue
    if PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select old_write('$u', $r, $d, 1)" >/dev/null 2>"$WORK/oe.$u"; then ok=$((ok + 1)); echo "$ok" > "$WORK/old.$u"
    else grep -q "managed by the server\|permission denied" "$WORK/oe.$u" && { echo "rejected" > "$WORK/old_rejected.$u"; break; }; fi
  done
}
awarder() { # awarder <worker> — параллельные начисления по пользователям, пишет только успешные
  local w="$1" i=0 n u
  while [ ! -e "$WORK/stop" ]; do
    i=$((i + 1)); n=$(( (i + w) % USERS + 1 )); u="00000000-0000-0000-0000-0000000fc00$n"
    st=$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select award_xp('$u','lesson_complete','w$w-$i',2,null)->>'status'" 2>/dev/null) || continue
    [ "$st" = "awarded" ] && echo "$u" >> "$WORK/awards.$w"
  done
}
for n in $(seq 1 $USERS); do old_writer "00000000-0000-0000-0000-0000000fc00$n" & done
for w in 1 2 3 4; do awarder "$w" & done
sleep 3
attempts=0; until PGDATABASE="$FLIP_DB" "${PSQL[@]}" -1 -f "$MIGRATIONS/0060_xp_rewards_lockdown.sql" >/dev/null 2>"$WORK/mig.err"; do
  attempts=$((attempts + 1)); echo "   0060 не применилась (попытка $attempts): $(head -1 "$WORK/mig.err")"; [ "$attempts" -lt 3 ] || { touch "$WORK/stop"; wait; echo "0060 не применилась под нагрузкой" >&2; exit 1; }; sleep 1
done
echo "   ok: 0060 применена под нагрузкой с попытки $((attempts + 1))"
sleep 3
touch "$WORK/stop"; wait
total_old=0; total_awards=0
for n in $(seq 1 $USERS); do
  u="00000000-0000-0000-0000-0000000fc00$n"
  old=$(cat "$WORK/old.$u" 2>/dev/null || echo 0)
  awards=$(cat "$WORK"/awards.* 2>/dev/null | grep -c "$u" || true)
  exp_counter=$((1000 + old + awards * 2))
  got=$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select xp from profiles where id='$u'")
  got_day=$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select coalesce(xp,0) from activity_days where user_id='$u' and day=(now() at time zone 'UTC')::date")
  ledger=$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select coalesce(sum(amount),0) from xp_events where user_id='$u'")
  check "пользователь $n: profiles.xp = 1000 + записи старого ($old) + начисления нового ($awards × 2)" "$got" "$exp_counter"
  check "пользователь $n: activity_days.xp = записи старого + начисления нового" "$got_day" "$((old + awards * 2))"
  check "пользователь $n: журнал = начисления нового" "$ledger" "$((awards * 2))"
  total_old=$((total_old + old)); total_awards=$((total_awards + awards))
done
check "старые писатели были отклонены после 0060 (все $USERS)" "$(ls "$WORK"/old_rejected.* 2>/dev/null | wc -l)" "$USERS"
check "в базе не осталось неприменённого" "$(PGDATABASE="$FLIP_DB" "${QUERY[@]}" -c "select public.rewards_phase() || '/' || (select count(*) from xp_events where not applied)")" "live/0"
[ "$total_old" -gt 0 ] && [ "$total_awards" -gt 0 ] || { echo "нагрузка не создана (старых записей $total_old, начислений $total_awards)" >&2; exit 1; }
echo "   нагрузка: старых записей $total_old, начислений $total_awards"

echo "== БАЗА 4 (${MAIN_DB}_race_*): гонки старых запросов с 0060 на реальных параллельных сессиях"
PGDATABASE="$MAIN_DB" bash "$HERE/race_0060.sh" 2>&1 | grep -v NOTICE | sed 's/^/   /' | sed 's/^   ==/ ==/'
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "ГОНКИ 0060 НЕ ПРОЙДЕНЫ" >&2; exit 1; }

if [ "$fail" -ne 0 ]; then echo "ПРОВЕРКИ НЕ ПРОЙДЕНЫ" >&2; exit 1; fi
echo "ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ"
