#!/usr/bin/env bash
# Изолированная production-сборка LexReader: `npm run build` и E2E без
# единого касания рабочего дерева (.next), dev-сервера на :3000 и чужих
# сервисов на машине.
#
#   scripts/isolated-build.sh            собрать (копия кода + свой .next)
#   scripts/isolated-build.sh --start    собрать и запустить на :$ISO_PORT (по умолчанию 3200)
#   scripts/isolated-build.sh --stop     остановить запущенный экземпляр
#   scripts/isolated-build.sh --clean    остановить и удалить копию целиком
#
# Как это устроено:
#   • код копируется rsync-ом в $ISO_DIR (по умолчанию ~/.cache/lexreader-isolated-build)
#     без .git, .next, node_modules, android/ios и рабочих артефактов;
#   • node_modules — жёсткие ссылки (cp -al): мгновенно, без лишних ГБ. Turbopack не
#     принимает symlink на node_modules вне корня проекта, поэтому именно hardlink;
#     если ФС другая — обычная копия;
#   • .env.local в копии пересоздаётся из блока env: файла .github/workflows/ci.yml —
#     публичные demo-ключи локального Supabase, БЕЗ боевых секретов, PostHog и воркеров,
#     а NEXT_PUBLIC_SITE_URL указывает на изолированный порт (NEXT_PUBLIC_* зашиваются на сборке);
#   • порт по умолчанию 3200 — не 3000 (dev-сервер), не 3001 (на этой машине это
#     Docker-контейнер чужого проекта), не 3100 (UI-kit dev).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISO_DIR="${ISO_DIR:-$HOME/.cache/lexreader-isolated-build}"
ISO_PORT="${ISO_PORT:-3200}"
PIDFILE="$ISO_DIR/.server.pid"

stop_server() {
  # Гасим процессы ТОЛЬКО если сервер запускали мы (есть pid-файл): находим
  # слушателя нашего порта и убиваем его группу (npx → next-server — дети setsid-лидера).
  if [[ -f "$PIDFILE" ]]; then
    local listener pgid
    listener="$(ss -ltnp 2>/dev/null | grep ":${ISO_PORT}\b" | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
    if [[ -n "$listener" ]]; then
      pgid="$(ps -o pgid= -p "$listener" | tr -d ' ')"
      kill -- "-$pgid" 2>/dev/null || kill "$listener"
      echo "остановлен изолированный сервер (:$ISO_PORT, группа $pgid)"
    else
      kill -- "-$(cat "$PIDFILE")" 2>/dev/null || true
      echo "порт $ISO_PORT уже свободен"
    fi
  else
    echo "изолированный сервер не запущен (pid-файла нет)"
  fi
  rm -f "$PIDFILE"
}

case "${1:-}" in
  --stop) stop_server; exit 0 ;;
  --clean)
    [[ "$ISO_DIR" == "$HOME/.cache/"* ]] || { echo "отказ: ISO_DIR вне ~/.cache ($ISO_DIR)"; exit 1; }
    stop_server
    rm -rf "$ISO_DIR" && echo "удалено: $ISO_DIR"; exit 0 ;;
esac

if [[ "${1:-}" == "--start" && ! -f "$PIDFILE" ]] && ss -ltn 2>/dev/null | grep -q ":${ISO_PORT}\b"; then
  echo "порт $ISO_PORT уже занят не нами — задай другой: ISO_PORT=3300 $0 --start"; exit 1
fi

mkdir -p "$ISO_DIR"
echo "▸ копирую код → $ISO_DIR"
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude android --exclude ios \
  --exclude .lex-work --exclude test-results --exclude playwright-report \
  --exclude .artifact-publish-tmp --exclude graphify-out --exclude .env.local \
  --exclude .server.pid --exclude server.log \
  "$ROOT"/ "$ISO_DIR"/

if [[ ! -e "$ISO_DIR/node_modules" ]]; then
  echo "▸ node_modules → жёсткие ссылки"
  cp -al "$ROOT/node_modules" "$ISO_DIR/node_modules" 2>/dev/null || { echo "  (другая ФС — полная копия)"; cp -a "$ROOT/node_modules" "$ISO_DIR/node_modules"; }
fi

echo "▸ .env.local из блока env: в ci.yml (demo-ключи, без боевых секретов)"
python3 - "$ROOT/.github/workflows/ci.yml" "$ISO_PORT" > "$ISO_DIR/.env.local" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
block = re.search(r"^env:\n((?:  .*\n|\n)+)", text, re.M).group(1)
out = []
for line in block.splitlines():
    m = re.match(r"\s+([A-Z0-9_]+):\s*(.+?)\s*$", line)
    if not m:
        continue
    k, v = m.groups()
    if k == "NEXT_PUBLIC_SITE_URL":
        v = f"http://127.0.0.1:{sys.argv[2]}"
    out.append(f"{k}={v}")
print("\n".join(out))
PY

echo "▸ next build (изолированный .next)"
( cd "$ISO_DIR" && npx next build )
echo "✓ сборка готова: $ISO_DIR/.next (рабочий $ROOT/.next не тронут)"

if [[ "${1:-}" == "--start" ]]; then
  stop_server >/dev/null 2>&1 || true
  # -H 127.0.0.1: слушаем только loopback (по умолчанию next start открывает 0.0.0.0).
  # setsid + </dev/null: процесс не держит терминал/пайп вызывающего и гасится группой.
  ( cd "$ISO_DIR" && MOMENTS_GALLERY=1 setsid nohup npx next start -H 127.0.0.1 -p "$ISO_PORT" > "$ISO_DIR/server.log" 2>&1 < /dev/null & echo $! > "$PIDFILE" )
  for _ in $(seq 1 30); do curl -fs -o /dev/null "http://127.0.0.1:${ISO_PORT}/login" && break; sleep 1; done
  echo "✓ запущено: http://127.0.0.1:${ISO_PORT}  (остановить: $0 --stop; лог: $ISO_DIR/server.log)"
fi
