# Medallion Lab

[![CI](https://github.com/vishalm/medallion-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/vishalm/medallion-lab/actions/workflows/ci.yml)
[![Pages · publish](https://github.com/vishalm/medallion-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/vishalm/medallion-lab/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-gold)](#)

> **Hands-on Data &amp; AI for students.** Nine interactive acts cover OLTP vs OLAP, cubes, star schemas, the Medallion pipeline (Bronze → Silver → Gold), mining techniques, a SQL playground, and a CFO Finance Lab with text-to-SQL over a **local LLM**.

Originally built as the live companion to the *Data &amp; AI: The Honest Tour* guest lecture at **Amity University (CSIT341)** — now a self-contained, browser-based playground anyone can clone, boot, and break.

> **Live preview:** [vishalm.github.io/medallion-lab](https://vishalm.github.io/medallion-lab/) — visual tour only. For full functionality (interactive acts + AI chat) clone and run via `docker compose up`.

---

## Why Medallion Lab

Most data-and-AI courses tell you what a Medallion architecture is. Medallion Lab lets you **press the button**:

- See raw, messy CSVs on the left.
- Watch them flow into a typed Silver table.
- See Gold marts emerge.
- Inject schema drift, dupes, null floods — watch the pipeline catch them.
- Then ask in plain English: *"Top 5 vendors by total spend?"* — and watch a local LLM write the SQL, run it, and render a chart.

Everything runs locally. No cloud lock-in. SQLite for storage. Ollama (or any OpenAI-compatible provider) for the LLM.

---

## The nine acts

| # | Act | What students see |
|---|-----|-------------------|
| 1 | The Landscape | Animated 2010→2026 data-volume bubble |
| 2 | OLTP vs OLAP | Live OLTP ticker vs slow aggregate query; the 11am-crash war story |
| 3 | The Cube | Interactive 3D cube with Slice / Dice / Drill / Roll-up / Pivot |
| 4 | Star · Snowflake · Galaxy | Morphing schema diagram; click a dim to see rows |
| 5 | **Medallion (lecture hero)** | Bronze → Silver → Gold pipeline with schema-drift, dupe-flood, and null-flood injectors |
| 6 | Mining → AI | Five live mini-models: classification, regression, clustering, association, anomaly |
| 7 | SQL Playground | Monaco editor querying Bronze / Silver / Gold side-by-side with timings |
| 8 | Take-home | Interactive version of the slide-30 "10 things to remember" |
| 9 | **CFO Finance Lab (demo hero)** | One CFO storyline · five stages — **MESS · TRUST · DECIDE · PREDICT · ASK** — ending with rich-markdown text-to-SQL chat over a local LLM, dynamic charts, day-of-week patterns, next-month forecasts, and Gini-style vendor concentration risk |

A persistent **floating chat** ("Ask the data") sits bottom-right on every page so students can query the warehouse from anywhere in the app.

---

## Quick start (Docker — recommended)

One command brings up the full stack: app on `:8000` + Ollama in its own container. First boot pulls the model (`qwen2.5-coder:1.5b`, ~1 GB); subsequent boots are instant.

```bash
docker compose up --build
# open http://localhost:8000
```

`docker compose down` keeps your seeded data and pulled model. `docker compose down -v` is the explicit wipe.

### Override anything via `.env`

```bash
APP_PORT=8000
OLLAMA_PORT=11434

# Acts 1-8 scale
SEED_ROWS=50000
SEED_CUSTOMERS=3000
SEED_OLTP=15000

# Act 9 scale
SEED_FINANCE_MONTHS=12
SEED_FINANCE_EMPLOYEES=30
SEED_FINANCE_VENDORS=20

# LLM (defaults work; uncomment to override)
# LLM_PROVIDER=ollama
# LLM_MODEL=qwen2.5-coder:1.5b
# LLM_BASE_URL=http://ollama:11434/v1     # colocated container
# LLM_BASE_URL=http://host.docker.internal:11434/v1  # host-installed Ollama
```

See [`.env.example`](.env.example) for every supported variable, with worked examples for **OpenRouter, Azure OpenAI, NVIDIA NIM, and OpenAI**.

---

## Quick start (local dev, no Docker)

```bash
# backend
cd app/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (separate terminal)
cd app/frontend
npm install
npm run dev   # http://localhost:5173, /api proxied to :8000
```

For Act 9 you also need a local LLM. The included script handles it:

```bash
bash scripts/setup_ollama.sh   # installs Ollama if missing, pulls the model, smoke-tests
```

---

## Tech

- **Backend** · FastAPI · SQLite (WAL) · Faker · scikit-learn · mlxtend · NumPy / Pandas · httpx
- **Frontend** · React · Vite · TypeScript · Tailwind · Framer Motion · React Flow · React Three Fiber · D3 · Recharts · Monaco · react-markdown
- **AI / LLM** · Provider-agnostic, env-driven. Default is local **Ollama** (`qwen2.5-coder:1.5b`, ~1 GB, code-tuned for SQL). Swap to **Azure OpenAI / OpenRouter / NVIDIA NIM / OpenAI** by changing `.env` only — no code changes
- **Theming** · Light + dark with Apple-style glassmorphism. CSS variables + `html.light` / `html.dark` swap the entire token set. Persisted in `localStorage`, follows `prefers-color-scheme` on first visit
- **Deploy** · Single Docker compose stack (app + Ollama). Railway runs the app container only — Ollama is local-only by design

---

## Rich AI responses

Every text-to-SQL answer ships three layers:

1. **Markdown narrative** — bold callouts of the top results, AED totals, trend hints. Rendered via `react-markdown` with custom-styled lists, code, headings.
2. **Auto-picked dynamic chart** — backend infers chart type from result columns (`stat`, `bar`, `donut`, `area`, `composed`) and the frontend renders a fancy gradient-filled variant from the bundled `ChartKit`.
3. **The SQL itself** — collapsible, syntax-highlighted. Always one click away.

So *"Top 5 vendors by total spend"* doesn't return a CSV dump — it returns:
> *Found **5** rows. Top results: **Google** — 444K AED · txn_count: **110** · Followed by DHL, LinkedIn, Zoom, Salik. Total: **1.59M AED**.*

…with a composed gradient bar+line chart underneath, and the SQL one click away.

---

## AI / LLM configuration

Every LLM call goes through one client (`app/backend/finance/llm_client.py`) that speaks the **OpenAI-compatible Chat Completions API**. Ollama, OpenRouter, NVIDIA NIM, vLLM, and Azure OpenAI all speak this shape. Change provider with two env vars:

```bash
# OpenRouter (one key, hundreds of models)
LLM_PROVIDER=openrouter
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=meta-llama/llama-3.1-8b-instruct
LLM_API_KEY=sk-or-...

# Azure OpenAI
LLM_PROVIDER=azure
LLM_BASE_URL=https://YOUR-RESOURCE.openai.azure.com
LLM_MODEL=gpt-4o-mini
LLM_AZURE_DEPLOYMENT=my-gpt4o-mini
LLM_AZURE_API_VERSION=2024-08-01-preview
LLM_API_KEY=...

# NVIDIA NIM
LLM_PROVIDER=nvidia
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=meta/llama-3.1-8b-instruct
LLM_API_KEY=nvapi-...
```

Real keys never go in Git — `.env` is gitignored, only `.env.example` ships with placeholder values.

---

## Tests

```bash
cd app
pip install -r backend/requirements.txt pytest
pytest tests/    # 51 tests; the Act 9 ones don't need Ollama
```

Tests are hermetic — they spin up an isolated SQLite under a tempdir, seed deterministically (`RANDOM_SEED = 20260421`), and cover normalize, FX, alias resolution, pipeline idempotency, mart correctness, Pareto monotonicity, anomaly bounds, and the SQL safety guard.

---

## Take-home notebook

[`notebooks/cfo_finance_lab.ipynb`](notebooks/cfo_finance_lab.ipynb) mirrors the Act 9 flow as a Python notebook against the same `/api/finance/*` endpoints. Students can run it locally with their own questions — the same `.env` config drives both surfaces, so an OpenRouter key in `.env` works in the notebook too.

---

## Continuous Integration & Pages

Two GitHub Actions workflows ship with the repo:

### [`ci.yml`](.github/workflows/ci.yml) — four parallel stages on every push / PR

| Stage | What runs |
|---|---|
| **Backend · pytest** | `pytest tests/` against an isolated SQLite tempdir (51 tests, ~8s) |
| **Backend · compile + import smoke** | `compileall` every `.py` + smoke-import the FastAPI app |
| **Frontend · tsc + vite build** | `tsc --noEmit` + `npm run build`, uploads the production bundle as a 7-day artifact |
| **Docker · build image** | Multi-stage Docker build with buildx + GHA cache; boots the container and hits `/api/health` and `/api/finance/counts` to confirm it's actually serving |

The Docker stage waits for the other three so a failing test doesn't burn buildx time.

### [`pages.yml`](.github/workflows/pages.yml) — auto-publish to GitHub Pages

On every push to `main` that touches `app/frontend/**`, the workflow builds the React bundle with `BASE_PATH=/medallion-lab/` and deploys to **<https://vishalm.github.io/medallion-lab/>**.

To wire the live Pages preview to a real backend (e.g. Railway), set the repo secret `VITE_API_BASE` to your backend's public URL and the next deploy will pick it up. Without it, Acts 1–9 render visually but `/api` calls 404 — the visual tour still demos beautifully.

A `404.html` SPA-fallback shim is included so deep-link refreshes (e.g. `…/act/9`) land on the right route.

---

## Deploy to Railway

```bash
railway up
```

Or connect the repo at railway.app — the included `Dockerfile` and `railway.json` are picked up automatically. SQLite is ephemeral by design on Railway; the `/api/reset` endpoint re-seeds from scratch so every lecture starts clean.

> **Note:** Railway runs the app container only. Ollama doesn't run there. Acts 1–8 work fully on Railway; Act 9's chat panel detects the missing LLM endpoint and renders a graceful "run locally for full experience" empty state. For the full demo, run via `docker compose up` on a laptop.

---

## Design principles

- **No emoji, no icon libraries.** Every visual indicator is an inline SVG ([app/frontend/src/icons/](app/frontend/src/icons/)).
- **Synthetic data only.** Faker-generated on boot; deterministic via a fixed seed so every lecture boot is identical.
- **Stage-demo first.** Anything that "almost works" is a bug. `/api/reset` is the panic button.
- **Local-first AI.** Default LLM is Ollama on the same host. Cloud providers are opt-in via `.env` — never required.
- **Theme-aware everything.** Light + dark switch flips the entire token set instantly; charts, tables, panels, and tooltips all reflow.

---

## Branding

- **Name** — Medallion Lab
- **One-liner** — Hands-on Data &amp; AI for students
- **Hero colour** — `--accent: rgb(241 176 44)` (gold)
- **Mascot diagram** — the Medallion pipeline (Act 5). If you have to pick one image to represent the project, pick that.
- **Origin** — Vishal Mishra · CSIT341 · Amity University

---

## Credits

Built as the hands-on follow-up to the `DataAI_GuestLecture_VishalMIshra-v2` deck (see [`docs/`](docs/)). Free to clone, fork, and remix for your own class.
