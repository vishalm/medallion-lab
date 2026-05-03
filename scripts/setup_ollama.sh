#!/usr/bin/env bash
# Idempotent setup for the local LLM that powers Act 9 (CFO Finance Lab).
# Installs Ollama if missing, pulls the configured model, smoke-tests the
# OpenAI-compatible endpoint. Reads .env so the model and base URL match
# what the backend will use.
#
# Usage: bash scripts/setup_ollama.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

# ---- Pull config (from .env if present, otherwise defaults) ---------------

LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
LLM_MODEL="${LLM_MODEL:-qwen2.5-coder:1.5b}"
LLM_BASE_URL="${LLM_BASE_URL:-http://localhost:11434/v1}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(LLM_PROVIDER|LLM_MODEL|LLM_BASE_URL)=' "$ENV_FILE" | xargs -I{} echo {} || true)
fi

if [ "$LLM_PROVIDER" != "ollama" ]; then
  echo "LLM_PROVIDER=$LLM_PROVIDER (not ollama). This script only sets up local Ollama."
  echo "If you want Ollama as the default again, unset LLM_PROVIDER or set it to 'ollama'."
  exit 0
fi

# ---- Install Ollama if missing -------------------------------------------

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama not found. Installing..."
  case "$(uname -s)" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install ollama
      else
        echo "Homebrew not installed. Install from https://ollama.com or install brew first."
        exit 1
      fi
      ;;
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    *)
      echo "Unsupported OS: $(uname -s). Install Ollama manually from https://ollama.com"
      exit 1
      ;;
  esac
else
  echo "Ollama already installed: $(ollama --version 2>/dev/null || echo present)"
fi

# ---- Make sure Ollama is running -----------------------------------------

if ! curl -fsS "$LLM_BASE_URL/models" >/dev/null 2>&1 \
   && ! curl -fsS "${LLM_BASE_URL%/v1}/api/tags" >/dev/null 2>&1; then
  echo "Ollama doesn't appear to be running. Starting it in the background..."
  # Start serve in background; harmless if already running (fails fast).
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  # Give it a moment to come up.
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if curl -fsS "${LLM_BASE_URL%/v1}/api/tags" >/dev/null 2>&1; then
      break
    fi
    if [ "$i" -eq 10 ]; then
      echo "Could not reach Ollama at $LLM_BASE_URL after 10s — see /tmp/ollama.log"
      exit 1
    fi
  done
fi

echo "Ollama is reachable at $LLM_BASE_URL"

# ---- Pull the model ------------------------------------------------------

echo "Pulling model: $LLM_MODEL (this may take a few minutes the first time)"
if ! ollama pull "$LLM_MODEL"; then
  echo "Failed to pull '$LLM_MODEL'. Falling back to llama3.2:1b (~1.3 GB)."
  ollama pull llama3.2:1b
  LLM_MODEL="llama3.2:1b"
  echo "Set LLM_MODEL=llama3.2:1b in your .env to use this model going forward."
fi

# ---- Smoke test ----------------------------------------------------------

echo
echo "Smoke test ($LLM_MODEL via $LLM_BASE_URL)..."
RESP="$(curl -sS -X POST "$LLM_BASE_URL/chat/completions" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ollama' \
  -d "{\"model\":\"$LLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: ready.\"}],\"max_tokens\":8,\"stream\":false,\"temperature\":0}" \
  || true)"

if echo "$RESP" | grep -qi '"content"'; then
  echo "OK — model responded."
  echo "Snippet: $(echo "$RESP" | head -c 200)"
else
  echo "Smoke test failed. Raw response:"
  echo "$RESP" | head -c 500
  echo
  exit 1
fi

echo
echo "Done. Act 9 (CFO Finance Lab) will use: provider=ollama, model=$LLM_MODEL"
echo "If you want a different model, edit .env (LLM_MODEL=...) — no code changes needed."
