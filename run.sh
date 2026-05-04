#!/usr/bin/env bash
# Medallion Lab — one entrypoint for every dev / demo / test command.
#
#   bash run.sh help            # show all commands
#   bash run.sh install         # install backend + frontend + e2e deps
#   bash run.sh dev             # backend + frontend in parallel (Ctrl-C stops both)
#   bash run.sh start           # build frontend, serve via FastAPI on :8000
#   bash run.sh test            # full suite: backend unit + frontend e2e
#   bash run.sh docker:up       # full stack via docker compose
#
# Designed to be safe to re-run (idempotent), readable on stage, and to
# never silently swallow errors. No emoji per project house rules — see
# ../CLAUDE.md.
set -euo pipefail

# ----- shell setup --------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/app/backend"
FRONTEND="$ROOT/app/frontend"
TESTS_PY="$ROOT/app/tests"
TESTS_E2E="$ROOT/app/frontend/tests-e2e"
VENV="$BACKEND/.venv"

APP_PORT="${APP_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"

# Colour output, but only when attached to a terminal.
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_GOLD=$'\033[38;5;220m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_BLUE=$'\033[34m'; C_GREY=$'\033[90m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GOLD=""; C_RED=""; C_GREEN=""; C_BLUE=""; C_GREY=""
fi

log()  { printf '%s[run.sh]%s %s\n' "$C_GOLD" "$C_RESET" "$*"; }
warn() { printf '%s[run.sh] %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; }
step() { printf '\n%s>>> %s%s\n' "$C_BOLD" "$*" "$C_RESET"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ----- helpers ------------------------------------------------------------

require() {
  for bin in "$@"; do
    if ! have "$bin"; then
      warn "missing required binary: $bin"
      warn "install it and re-run."
      exit 1
    fi
  done
}

activate_venv() {
  if [ ! -d "$VENV" ]; then
    step "creating Python venv at $VENV"
    require python3
    python3 -m venv "$VENV"
  fi
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
}

ensure_python_deps() {
  activate_venv
  if ! python -c "import fastapi" >/dev/null 2>&1; then
    step "installing backend Python deps"
    pip install --quiet --upgrade pip
    pip install --quiet -r "$BACKEND/requirements.txt"
  fi
}

ensure_pytest() {
  ensure_python_deps
  if ! python -c "import pytest" >/dev/null 2>&1; then
    pip install --quiet pytest
  fi
}

ensure_node_deps() {
  require node npm
  if [ ! -d "$FRONTEND/node_modules" ]; then
    step "installing frontend deps (npm install)"
    (cd "$FRONTEND" && npm install)
  fi
}

ensure_playwright() {
  ensure_node_deps
  if [ ! -d "$FRONTEND/node_modules/@playwright/test" ]; then
    step "installing @playwright/test"
    (cd "$FRONTEND" && npm install --no-save --silent @playwright/test@^1.48.0)
  fi
  if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
    step "installing Playwright browsers (one-time, ~150MB)"
    (cd "$FRONTEND" && npx --yes playwright install chromium)
  fi
}

wait_for_http() {
  # wait_for_http URL [timeout_seconds]
  local url="$1" timeout="${2:-30}" elapsed=0
  log "waiting for $url (max ${timeout}s)..."
  while ! curl -fsS "$url" >/dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$timeout" ]; then
      warn "timed out waiting for $url"
      return 1
    fi
  done
  log "$url is up after ${elapsed}s"
}

kill_descendants() {
  # Kill the whole process group on exit so background uvicorn / vite die.
  if [ -n "${RUN_BG_PIDS:-}" ]; then
    log "stopping background jobs: $RUN_BG_PIDS"
    # shellcheck disable=SC2086
    kill $RUN_BG_PIDS 2>/dev/null || true
    wait 2>/dev/null || true
  fi
}

# ----- commands -----------------------------------------------------------

cmd_help() {
  cat <<EOF
${C_BOLD}Medallion Lab — run.sh${C_RESET}
${C_GREY}One entrypoint for the lecture demo. Pick a command below.${C_RESET}

${C_BOLD}Setup${C_RESET}
  install              Install backend (pip), frontend (npm), and e2e (Playwright) deps
  install:backend      Install backend Python deps only
  install:frontend     Install frontend npm deps only
  install:e2e          Install Playwright + browsers
  ollama               Bootstrap local Ollama for Act 9 (calls scripts/setup_ollama.sh)
  clean                Remove venv, node_modules, dist, caches, and the SQLite DB

${C_BOLD}Develop${C_RESET}
  backend              Run FastAPI on :$APP_PORT with --reload
  frontend             Run Vite dev server on :$WEB_PORT (proxies /api -> :$APP_PORT)
  dev                  Run backend + frontend together (Ctrl-C stops both)

${C_BOLD}Build${C_RESET}
  build                Build the frontend bundle into app/frontend/dist
  build:backend        Sanity-check backend imports compile (no artifact)
  start                Build frontend, then serve everything via FastAPI on :$APP_PORT

${C_BOLD}Test${C_RESET}
  test                 Run backend unit tests and frontend e2e tests
  test:backend         pytest app/tests/
  test:unit            pytest app/tests/test_unit_showcase.py (the showcase suite)
  test:e2e             Playwright UI tests (boots backend + Vite, runs, tears down)
  test:e2e:headed      Same, but show the browser (great on stage)
  test:frontend        Alias for test:e2e
  lint                 tsc --noEmit on the frontend

${C_BOLD}Docker${C_RESET}
  docker:build         docker compose build
  docker:up            docker compose up -d (app + Ollama)
  docker:up:fg         docker compose up (foreground; logs in your terminal)
  docker:down          docker compose down (keeps the named volume)
  docker:wipe          docker compose down -v (deletes the SQLite + Ollama models)
  docker:logs          tail logs from the app container
  docker:rebuild       docker compose down + build + up -d

${C_BOLD}Demo controls${C_RESET}
  reset                POST /api/reset on the running backend (synthetic data wipe + reseed)
  health               GET /api/health on :$APP_PORT
  open                 Open the app in your default browser

${C_DIM}Env knobs (override on the command line):${C_RESET}
  APP_PORT=$APP_PORT  WEB_PORT=$WEB_PORT
EOF
}

cmd_install_backend() { ensure_python_deps; log "backend deps OK"; }
cmd_install_frontend() { ensure_node_deps; log "frontend deps OK"; }
cmd_install_e2e()      { ensure_playwright; log "playwright deps OK"; }

cmd_install() {
  cmd_install_backend
  cmd_install_frontend
  cmd_install_e2e
  log "all deps installed"
}

cmd_clean() {
  step "cleaning build artefacts and local state"
  rm -rf "$FRONTEND/dist" "$FRONTEND/node_modules" "$VENV"
  rm -rf "$BACKEND/__pycache__" "$BACKEND/data" "$ROOT"/app/**/__pycache__ 2>/dev/null || true
  find "$ROOT/app" -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
  log "clean done. run 'bash run.sh install' to set up again."
}

cmd_ollama() {
  if [ ! -f "$ROOT/scripts/setup_ollama.sh" ]; then
    warn "scripts/setup_ollama.sh missing"; exit 1
  fi
  bash "$ROOT/scripts/setup_ollama.sh"
}

cmd_backend() {
  ensure_python_deps
  step "starting FastAPI on http://localhost:$APP_PORT"
  cd "$ROOT/app"
  exec uvicorn backend.main:app --reload --host 0.0.0.0 --port "$APP_PORT"
}

cmd_frontend() {
  ensure_node_deps
  step "starting Vite dev server on http://localhost:$WEB_PORT"
  cd "$FRONTEND"
  exec npm run dev -- --port "$WEB_PORT" --host
}

cmd_dev() {
  ensure_python_deps
  ensure_node_deps
  step "starting backend (:$APP_PORT) and frontend (:$WEB_PORT) together"
  trap kill_descendants EXIT INT TERM

  ( cd "$ROOT/app" && uvicorn backend.main:app --reload --host 0.0.0.0 --port "$APP_PORT" ) &
  RUN_BG_PIDS="$!"
  ( cd "$FRONTEND" && npm run dev -- --port "$WEB_PORT" --host ) &
  RUN_BG_PIDS="$RUN_BG_PIDS $!"

  log "backend pid + frontend pid: $RUN_BG_PIDS"
  log "press Ctrl-C to stop both"
  wait
}

cmd_build() {
  ensure_node_deps
  step "building frontend bundle"
  (cd "$FRONTEND" && npm run build)
  log "bundle written to $FRONTEND/dist"
}

cmd_build_backend() {
  ensure_python_deps
  step "smoke-importing backend"
  (cd "$ROOT/app" && python -c "from backend import main; print('backend imports OK')")
}

cmd_start() {
  cmd_build
  ensure_python_deps
  step "serving full stack on http://localhost:$APP_PORT (SPA + API)"
  # Mirror Dockerfile CMD so /static is served from the build output.
  cd "$ROOT/app"
  STATIC_DIR="$FRONTEND/dist" exec uvicorn backend.main:app --host 0.0.0.0 --port "$APP_PORT"
}

cmd_test_backend() {
  ensure_pytest
  step "running pytest"
  (cd "$ROOT/app" && pytest -q tests/)
}

cmd_test_unit() {
  ensure_pytest
  step "running showcase unit suite"
  (cd "$ROOT/app" && pytest -q tests/test_unit_showcase.py)
}

cmd_test_e2e() {
  local headed="${1:-}"
  ensure_python_deps
  ensure_playwright

  # The backend serves the SPA from app/frontend/dist (see config.STATIC_DIR).
  # Build once before booting so Playwright sees a real React app on :$APP_PORT.
  if [ ! -f "$FRONTEND/dist/index.html" ]; then
    cmd_build
  fi

  step "booting backend on :$APP_PORT for e2e tests"
  trap kill_descendants EXIT INT TERM

  ( cd "$ROOT/app" && STATIC_DIR="$FRONTEND/dist" uvicorn backend.main:app --host 0.0.0.0 --port "$APP_PORT" >/tmp/medallion-e2e-backend.log 2>&1 ) &
  RUN_BG_PIDS="$!"

  if ! wait_for_http "http://localhost:$APP_PORT/api/health" 60; then
    warn "backend never came up — see /tmp/medallion-e2e-backend.log"
    tail -n 80 /tmp/medallion-e2e-backend.log >&2 || true
    exit 1
  fi

  step "running Playwright suite"
  cd "$FRONTEND"
  if [ "$headed" = "--headed" ]; then
    BACKEND_URL="http://localhost:$APP_PORT" npx playwright test --headed
  else
    BACKEND_URL="http://localhost:$APP_PORT" npx playwright test
  fi
}

cmd_test() {
  cmd_test_backend
  cmd_test_e2e
  log "all green"
}

cmd_lint() {
  ensure_node_deps
  step "tsc --noEmit"
  (cd "$FRONTEND" && npx tsc --noEmit)
}

cmd_docker_build()    { require docker; (cd "$ROOT" && docker compose build); }
cmd_docker_up()       { require docker; (cd "$ROOT" && docker compose up -d); log "open http://localhost:$APP_PORT"; }
cmd_docker_up_fg()    { require docker; (cd "$ROOT" && docker compose up); }
cmd_docker_down()     { require docker; (cd "$ROOT" && docker compose down); }
cmd_docker_wipe()     { require docker; (cd "$ROOT" && docker compose down -v); log "named volumes deleted"; }
cmd_docker_logs()     { require docker; (cd "$ROOT" && docker compose logs -f app); }
cmd_docker_rebuild()  { cmd_docker_down; cmd_docker_build; cmd_docker_up; }

cmd_reset() {
  require curl
  step "POST /api/reset"
  curl -fsS -X POST "http://localhost:$APP_PORT/api/reset" | head -c 1000; echo
}

cmd_health() {
  require curl
  curl -fsS "http://localhost:$APP_PORT/api/health" || { warn "backend not reachable"; exit 1; }
  echo
}

cmd_open() {
  local url="http://localhost:$APP_PORT"
  case "$(uname -s)" in
    Darwin) open "$url" ;;
    Linux)  xdg-open "$url" >/dev/null 2>&1 || true ;;
    *)      log "open $url manually" ;;
  esac
}

# ----- dispatcher ---------------------------------------------------------

main() {
  local cmd="${1:-help}"
  shift || true
  case "$cmd" in
    help|-h|--help)        cmd_help "$@" ;;
    install)               cmd_install ;;
    install:backend)       cmd_install_backend ;;
    install:frontend)      cmd_install_frontend ;;
    install:e2e)           cmd_install_e2e ;;
    clean)                 cmd_clean ;;
    ollama)                cmd_ollama ;;
    backend)               cmd_backend ;;
    frontend)              cmd_frontend ;;
    dev)                   cmd_dev ;;
    build)                 cmd_build ;;
    build:backend)         cmd_build_backend ;;
    start)                 cmd_start ;;
    test)                  cmd_test ;;
    test:backend)          cmd_test_backend ;;
    test:unit)             cmd_test_unit ;;
    test:e2e)              cmd_test_e2e ;;
    test:e2e:headed)       cmd_test_e2e --headed ;;
    test:frontend)         cmd_test_e2e ;;
    lint)                  cmd_lint ;;
    docker:build)          cmd_docker_build ;;
    docker:up)             cmd_docker_up ;;
    docker:up:fg)          cmd_docker_up_fg ;;
    docker:down)           cmd_docker_down ;;
    docker:wipe)           cmd_docker_wipe ;;
    docker:logs)           cmd_docker_logs ;;
    docker:rebuild)        cmd_docker_rebuild ;;
    reset)                 cmd_reset ;;
    health)                cmd_health ;;
    open)                  cmd_open ;;
    *)
      warn "unknown command: $cmd"
      echo
      cmd_help
      exit 2
      ;;
  esac
}

main "$@"
