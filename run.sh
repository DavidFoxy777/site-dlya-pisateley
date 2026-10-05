#!/usr/bin/env bash
# ============================================================
#  Запуск сайта «Визуальный Автор» одной командой.
#
#      ./run.sh            — обычный запуск на http://127.0.0.1:5000
#      ./run.sh --host     — открыть сайт ещё и в телефоне по Wi-Fi
#      ./run.sh --reload   — автоперезапуск при правках
#
#  Остановить: Ctrl+C
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"

# Ставим Flask, только если его нет — чтобы не мучить сеть повторно.
if ! "$PY" -c "import flask" >/dev/null 2>&1; then
  echo "Устанавливаю Flask…"
  "$PY" -m pip install --quiet --user -r requirements.txt
fi

# Проверяем, что content.json читается — иначе сервер упадёт с 500.
if ! "$PY" -c "import json;json.load(open('content.json',encoding='utf-8'))" 2>/dev/null; then
  echo ""
  echo "  Внимание: content.json не читается как JSON."
  echo "  Проверьте его командой:  $PY -m json.tool content.json"
  echo ""
fi

exec "$PY" app.py "$@"