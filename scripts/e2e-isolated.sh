#!/usr/bin/env bash
# Основной Playwright-набор (e2e/) против ИЗОЛИРОВАННОЙ среды: отдельный стек
# Supabase со своим project_id, отдельная сборка приложения на :3200. Не
# трогает: рабочий .next, dev на :3000, dev-стек этого проекта
# (project_id English_teacher_AI и его том с данными), чужие стеки
# (ai-automation-platform, twenty, n8n, …) и порт :3001.
#
#   scripts/e2e-isolated.sh preflight   только чтение: проверки + снимок чужих контейнеров
#   scripts/e2e-isolated.sh prepare     только подготовить копию конфигурации (без запуска чего-либо)
#   scripts/e2e-isolated.sh up          поднять стек Supabase (облегчённый) и приложение
#   scripts/e2e-isolated.sh test [args] прогнать Playwright (args → playwright test)
#   scripts/e2e-isolated.sh down        остановить всё СВОЁ, стереть свои тома, сверить снимок
#   scripts/e2e-isolated.sh status      что сейчас запущено нашего
#   DRY=1 scripts/e2e-isolated.sh up    показать команды, ничего не выполняя
#
# Почему отдельный project_id и каталог конфигурации:
#   • `supabase db reset` / `stop --no-backup` в каталоге репозитория стёрли бы том
#     supabase_db_English_teacher_AI (локальные данные разработки, 293 МБ, с сентября);
#     у изолированного стека том свой: supabase_db_English_teacher_AI_e2e.
#   • supabase/.temp/postgres-version в репозитории закрепляет образ 17.6.1.147 (его нет
#     локально → тяжёлый pull, вероятная причина двух прошлых «пустых» запусков);
#     в копии каталога .temp нет → CLI берёт свои образы по умолчанию, они уже скачаны.
#   • site_url/additional_redirect_urls в копии указывают на :3200 — иначе письмо сброса
#     пароля (auth.spec) вернёт на :3000, где ничего нет.
#   • Studio, analytics (logflare/vector), edge-runtime выключены в копии конфигурации.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_HOME="${E2E_HOME:-$HOME/.cache/lexreader-e2e}"
WORKDIR="$E2E_HOME/supabase-workdir"            # внутри — каталог supabase/
PROJECT_ID="English_teacher_AI_e2e"
APP_PORT="${ISO_PORT:-3200}"
BASELINE="$E2E_HOME/others-baseline.txt"
DRY="${DRY:-0}"

MIN_AVAIL_MB="${MIN_AVAIL_MB:-1200}"            # ниже — отказ
WARN_AVAIL_MB="${WARN_AVAIL_MB:-1800}"          # ниже — предупреждение
SB_PORTS=(54321 54322 54324)                    # API, Postgres (psql в e2e), Mailpit (auth.spec)

red() { printf '\033[31m%s\033[0m\n' "$*"; }
yel() { printf '\033[33m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
run() { if [[ "$DRY" == 1 ]]; then echo "  [dry] $*"; else "$@"; fi; }

mem_avail_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
swap_used_pct() { awk '/SwapTotal/ {t=$2} /SwapFree/ {f=$2} END {if (t>0) print int((t-f)*100/t); else print 0}' /proc/meminfo; }
psi_full() { awk '/^full/ {sub("avg10=","",$2); print $2}' /proc/pressure/memory 2>/dev/null || echo 0; }
port_busy() { ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1$"; }
ours() { docker ps -a --filter "label=com.supabase.cli.project=$PROJECT_ID" --format '{{.Names}}'; }
others_snapshot() {
  docker ps -a --format '{{.Names}} {{.State}}' | grep -v "_${PROJECT_ID} " | sort
}

ci_env() {   # блок env: из ci.yml → KEY=value (публичные demo-ключи локального Supabase)
  python3 - "$ROOT/.github/workflows/ci.yml" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
block = re.search(r"^env:\n((?:  .*\n|\n)+)", text, re.M).group(1)
for line in block.splitlines():
    m = re.match(r"\s+([A-Z0-9_]+):\s*(.+?)\s*$", line)
    if m: print(f"{m.group(1)}={m.group(2)}")
PY
}

preflight() {
  local fail=0 warn=0
  echo "== Docker =="
  if ! docker info >/dev/null 2>&1; then red "✗ docker недоступен"; return 1; fi
  grn "✓ docker $(docker version --format '{{.Server.Version}}'), запущено контейнеров: $(docker ps -q | wc -l), всего: $(docker ps -aq | wc -l)"
  local mine; mine="$(ours)"
  if [[ -n "$mine" ]]; then yel "! уже есть контейнеры изолированного стека ($PROJECT_ID):"; echo "$mine" | sed 's/^/    /'; warn=1; else grn "✓ изолированного стека ещё нет"; fi
  if docker ps --format '{{.Names}}' | grep -q "_English_teacher_AI$"; then
    yel "! запущен dev-стек проекта (project_id English_teacher_AI) — он занимает порты 54321+ и конфликтует с изолированным. Остановите его сами: supabase stop БЕЗ --no-backup (данные сохранятся)."; fail=1
  else grn "✓ dev-стек проекта не запущен (его том с данными останется нетронутым)"; fi
  echo; echo "== Память =="
  local avail swap psi; avail="$(mem_avail_mb)"; swap="$(swap_used_pct)"; psi="$(psi_full)"
  echo "  доступно: ${avail} МБ · swap занят: ${swap}% · PSI memory full avg10: ${psi}"
  if (( avail < MIN_AVAIL_MB )); then red "✗ доступно < ${MIN_AVAIL_MB} МБ — запуск отклонён (закройте тяжёлые приложения)"; fail=1
  elif (( avail < WARN_AVAIL_MB )); then yel "! доступно < ${WARN_AVAIL_MB} МБ — запуск возможен, но впритык"; warn=1
  else grn "✓ памяти достаточно"; fi
  if (( swap >= 90 )); then yel "! swap почти полон (${swap}%): при росте потребления система сможет только вытеснять кэш. 'up' ставит лимиты памяти на наши контейнеры (без swap)."; warn=1; fi
  if awk -v p="$psi" 'BEGIN{exit !(p+0 > 5)}'; then red "✗ высокое давление памяти (PSI full avg10=${psi} > 5)"; fail=1; fi
  echo; echo "== Диск =="
  local free_gb; free_gb="$(df -BG --output=avail "$HOME" | tail -1 | tr -dc '0-9')"
  if (( free_gb < 5 )); then red "✗ свободно ${free_gb} ГБ (< 5)"; fail=1; else grn "✓ свободно ${free_gb} ГБ"; fi
  echo; echo "== Порты =="
  for p in "${SB_PORTS[@]}" "$APP_PORT"; do
    if port_busy "$p"; then
      if [[ "$p" == "$APP_PORT" && -f "$HOME/.cache/lexreader-isolated-build/.server.pid" ]]; then yel "! :$p занят нашей предыдущей изолированной сборкой (будет перезапущена)"; warn=1
      else red "✗ порт :$p занят (ss -ltnp | grep :$p)"; fail=1; fi
    else grn "✓ :$p свободен"; fi
  done
  for p in 3001 3000; do if port_busy "$p"; then echo "  · :$p занят — не наш, не трогаем"; fi; done
  echo; echo "== Конфигурация и инструменты =="
  if command -v psql >/dev/null; then grn "✓ psql (нужен account-delete-export и today-crash-regression)"; else red "✗ psql не найден"; fail=1; fi
  if ls "$HOME"/.cache/ms-playwright/chromium-* >/dev/null 2>&1; then grn "✓ Chromium для Playwright"; else red "✗ нет Chromium: npx playwright install chromium"; fail=1; fi
  if npx --no-install supabase --version >/dev/null 2>&1; then grn "✓ supabase CLI $(npx --no-install supabase --version 2>/dev/null | head -1)"; else red "✗ supabase CLI недоступен"; fail=1; fi
  local ci_key root_key
  ci_key="$(ci_env | sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' | sha256sum | cut -c1-12)"
  root_key="$(sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' "$ROOT/.env.local" 2>/dev/null | sha256sum | cut -c1-12)"
  if [[ "$ci_key" == "$root_key" ]]; then grn "✓ ключ Supabase в .env.local = demo-ключ CI (совпадение по хэшу)"; else yel "! ключ в .env.local не совпадает с demo-ключом CI — 'test' передаёт ключи CI явно, .env.local не читается"; fi
  if [[ -d "$ROOT/supabase/.temp" ]]; then yel "! в supabase/.temp закреплены версии образов (postgres $(cat "$ROOT/supabase/.temp/postgres-version" 2>/dev/null)) — изолированная копия их не использует"; fi
  echo; echo "== Образы облегчённого стека — есть локально? =="
  for i in postgres gotrue postgrest realtime storage-api kong mailpit; do
    if docker images --format '{{.Repository}}' | grep -q "supabase/$i$"; then grn "✓ $i"; else yel "! $i нет локально — будет pull"; warn=1; fi
  done
  echo; echo "== Снимок чужих контейнеров =="
  mkdir -p "$E2E_HOME"; others_snapshot > "$BASELINE"
  echo "  записан: $BASELINE ($(wc -l < "$BASELINE") контейнеров, не running: $(grep -vc ' running$' "$BASELINE" || true))"
  echo
  if (( fail )); then red "ИТОГ: запуск НЕ рекомендуется (есть ✗)"; return 1; fi
  if (( warn )); then yel "ИТОГ: можно запускать, есть замечания (!)"; else grn "ИТОГ: всё в порядке"; fi
}

prepare_workdir() {
  echo "▸ каталог конфигурации изолированного стека → $WORKDIR (project_id $PROJECT_ID)"
  run mkdir -p "$WORKDIR/supabase"
  run rsync -a --delete --exclude .temp --exclude .branches "$ROOT/supabase/" "$WORKDIR/supabase/"
  if [[ "$DRY" == 1 ]]; then echo "  [dry] правка config.toml: project_id, site_url, redirect-urls → :$APP_PORT, studio/analytics/edge_runtime = off"; return; fi
  python3 - "$WORKDIR/supabase/config.toml" "$APP_PORT" "$PROJECT_ID" <<'PY'
import re, sys
path, port, pid = sys.argv[1], sys.argv[2], sys.argv[3]
section = None; out = []; skip_list = False
for line in open(path).read().split("\n"):
    m = re.match(r"^\[([^\]]+)\]\s*$", line)
    if m: section = m.group(1)
    if skip_list:
        if line.strip().startswith("]"): skip_list = False
        continue
    if section is None and re.match(r"^project_id\s*=", line):
        line = f'project_id = "{pid}"'
    elif section == "auth" and re.match(r"^site_url\s*=", line):
        line = f'site_url = "http://127.0.0.1:{port}"'
    elif section == "auth" and re.match(r"^additional_redirect_urls\s*=\s*\[", line):
        out += ['additional_redirect_urls = [',
                f'  "http://127.0.0.1:{port}",', f'  "http://127.0.0.1:{port}/auth/callback",',
                f'  "http://localhost:{port}/auth/callback",', ']']
        skip_list = not line.rstrip().endswith("]")
        continue
    elif section in ("studio", "analytics", "edge_runtime") and re.match(r"^enabled\s*=", line):
        line = "enabled = false"
    out.append(line)
open(path, "w").write("\n".join(out))
PY
  grep -nE '^project_id|^site_url|127\.0\.0\.1:'"$APP_PORT" "$WORKDIR/supabase/config.toml" | head -8
}

cap_memory() {   # лимиты ТОЛЬКО на наши контейнеры; memory-swap = memory → без swap (он полон)
  local -A CAP=( [db]=640m [auth]=192m [rest]=128m [realtime]=320m [storage]=192m [kong]=192m [inbucket]=96m )
  local svc n
  for svc in "${!CAP[@]}"; do
    n="supabase_${svc}_${PROJECT_ID}"
    if docker inspect "$n" >/dev/null 2>&1; then docker update --memory "${CAP[$svc]}" --memory-swap "${CAP[$svc]}" "$n" >/dev/null && echo "  лимит ${CAP[$svc]}: $n"; fi
  done
}

up() {
  preflight || { red "preflight не пройден — 'up' отменён"; exit 1; }
  prepare_workdir
  echo "▸ supabase start (изолированный, облегчённый). Следите за pull: docker images / docker ps в другом терминале."
  run timeout 900 bash -c "cd '$ROOT' && npx --no-install supabase start --workdir '$WORKDIR'"
  if [[ "$DRY" != 1 ]]; then cap_memory; fi
  echo "▸ изолированная сборка приложения на :$APP_PORT"
  run env ISO_PORT="$APP_PORT" "$ROOT/scripts/isolated-build.sh" --start
  grn "готово: Supabase API http://127.0.0.1:54321, Mailpit :54324, приложение http://127.0.0.1:$APP_PORT"
}

test_run() {
  echo "▸ Playwright (workers=1 из конфигурации) против http://127.0.0.1:$APP_PORT"
  local envs; mapfile -t envs < <(ci_env | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=')
  # наблюдатель: при критической нехватке памяти — останавливаем ТОЛЬКО свой прогон
  ( while sleep 5; do a="$(mem_avail_mb)"; if (( a < 300 )); then echo "!!! MemAvailable=${a} МБ — прерываю прогон Playwright"; pkill -u "$USER" -f "playwright test --project=chromium" || true; break; fi; done ) &
  local watcher=$!
  set +e
  ( cd "$ROOT" && env "${envs[@]}" E2E_BASE_URL="http://127.0.0.1:$APP_PORT" npx playwright test --project=chromium "$@" )
  local rc=$?
  set -e; kill "$watcher" 2>/dev/null || true
  return $rc
}

down() {
  echo "▸ останавливаю приложение (:$APP_PORT)"; run "$ROOT/scripts/isolated-build.sh" --stop || true
  local mine; mine="$(ours)"
  if [[ -n "$mine" ]]; then
    echo "▸ останавливаю и стираю ТОЛЬКО изолированный стек ($PROJECT_ID):"; echo "$mine" | sed 's/^/    /'
    run bash -c "cd '$ROOT' && npx --no-install supabase stop --workdir '$WORKDIR' --no-backup"
  else echo "  изолированного стека нет"; fi
  if [[ "$DRY" == 1 ]]; then return; fi
  if [[ -f "$BASELINE" ]]; then
    echo "▸ сверка чужих контейнеров со снимком до запуска"
    if diff <(others_snapshot) "$BASELINE" >/dev/null; then grn "✓ чужие контейнеры: имена и состояния не изменились"; else red "✗ ОТЛИЧИЯ в чужих контейнерах:"; diff <(others_snapshot) "$BASELINE" || true; fi
  fi
  echo "  осталось нашего: $(ours | wc -l) контейнеров; dev-том supabase_db_English_teacher_AI: $(docker volume ls -q | grep -c '^supabase_db_English_teacher_AI$') (должен быть 1)"
}

status() {
  echo "изолированный стек: $(ours | wc -l) контейнеров"; ours | sed 's/^/  /'
  if port_busy "$APP_PORT"; then echo "приложение :$APP_PORT: слушает"; else echo "приложение :$APP_PORT: не запущено"; fi
  echo "память: доступно $(mem_avail_mb) МБ, swap $(swap_used_pct)%"
}

case "${1:-}" in
  preflight) preflight ;;
  prepare) prepare_workdir ;;
  up) up ;;
  test) shift; test_run "$@" ;;
  down) down ;;
  status) status ;;
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
