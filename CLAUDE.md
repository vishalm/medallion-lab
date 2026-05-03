# CLAUDE.md — Medallion Lab

This file layers project-specific rules on top of the cross-project rules in [../CLAUDE.md](../CLAUDE.md). The parent file is the source of truth for emoji discipline, i18n, first-run UX, content architecture, secrets, Docker, platform gotchas, and engineering preferences. Anything here either (a) makes a parent rule concrete for this project, or (b) covers ground the parent doesn't.

> **Brand name: "Medallion Lab"** — that's the public product name shown in the UI shell, README, and meta tags. The repo is still `DataAI_Amity` for historical reasons; do not rename the directory. Internally we still call this "the Amity guest-lecture app" when context calls for it.

---

## 1. What this project is (and is not)

**Medallion Lab** is a visual, hands-on Data &amp; AI playground. Originally built as the live companion to the CSIT341 (Amity University) guest lecture *"Data &amp; AI: The Honest Tour"*. Students sit in a 1-hour room and watch one presenter (Vishal) drive **nine** interactive acts. Two heroes: **Act 5 (Medallion)** for the lecture, **Act 9 (CFO Finance Lab)** for the live AI demo.

It is **not** a production app. It is **not** a SaaS. It is **not** going to scale beyond ~30 students in one room.

That single fact reshapes every engineering decision below.

---

## 2. The non-negotiable: it must not break on stage

Lecture day is the only day that matters. The app gets booted on Vishal's laptop (and/or Railway), demoed for 60 minutes, and shut down. If anything fails live, the lecture fails.

Concrete rules:

- **`/api/reset` must be idempotent and bulletproof.** It is the panic button. Re-seeds the SQLite DB in <2 seconds. Never assume a clean state — always start by dropping and rebuilding.
- **Boot must seed-on-empty-only.** See [main.py:28](app/backend/main.py#L28) — `_db_exists_and_seeded()` checks for `gold_fact_sales` rows before deciding. Never destructively reset on boot. Destructive resets are opt-in via `/api/reset` only. (Parent rule: "Never drop, truncate, or destructively update existing rows at boot.")
- **Synthetic data is seeded with `RANDOM_SEED = 20260421`** ([config.py:19](app/backend/config.py#L19)). Same boot → same data → same demo. Do not introduce non-deterministic seeding.
- **Every API path returns within ~1s on demo data.** SQLite over WAL is fast enough; do not introduce blocking work. Long-running stuff (model fits, big aggregates) must be either pre-baked or capped.
- **No external network calls in the hot path by default.** No CDNs, no telemetry, no analytics. The lecture room WiFi is not trusted. Default LLM is local Ollama on the same host. Cloud providers (Azure / OpenRouter / NVIDIA / OpenAI) are opt-in via `.env` for non-stage deployments — see Section 10.
- **Shortcut keys ([ShortcutsModal.tsx](app/frontend/src/components/ShortcutsModal.tsx))** let Vishal jump between acts without touching the URL bar. Preserve them when adding new acts.

If you are tempted to add a feature that "almost always works," it is a bug. Stage demos eat almost-always.

---

## 3. Audience-shaped engineering

Students are **CSIT341 undergraduates**. Vishal is delivering this for them, not for engineers reading the source.

- **One teaching point per stage.** When in doubt, cut. See [feedback_lecture_simplicity.md](../../.claude/projects/-Users-vishalmishra-workspace-self-DataAI-Amity/memory/feedback_lecture_simplicity.md) (auto-memory) for the full bias.
- **Big buttons, sliders, drill-on-click.** UI affordances must be obvious to a student who has never used the app. Hover-only interactions are invisible on a projector.
- **Memorable framings.** Use parallel structure (e.g., the planned Act 9 framing: "MESS → TRUST → DECIDE → PREDICT → ASK") so students can recall on an exam.
- **Skip features that are realistic but mute on stage** (e.g., a forecast chart that just trends up). Favor visceral signals — anomaly spikes, dirty-row counters, schema-drift alerts.

---

## 4. Architecture in one paragraph

A single FastAPI service ([app/backend/main.py](app/backend/main.py)) exposes `/api/*` routes per act and serves the built React SPA from [`app/frontend/dist/`](app/frontend/dist) for every other path. SQLite (WAL mode, `app/backend/data/medallion.db`) is the only datastore — Bronze, Silver, Gold, OLTP, banking, telecom, and DQ events all live in one file. Faker generates synthetic data on first boot or on `POST /api/reset`. The frontend is Vite + React + TS + Tailwind, with Recharts/D3 for charts, React Flow for the schema diagrams, Three.js for the cube (Act 3), Monaco for the SQL editor (Act 7), and Framer Motion for transitions. Single Docker image deploys to Railway.

The medallion pipeline ([app/backend/medallion/pipeline.py](app/backend/medallion/pipeline.py)) is **re-runnable by design** — every transform truncates its target and rebuilds from the layer above, so the UI can hit "replay" without state drift.

---

## 5. Repo layout (skim before editing)

```
app/
  backend/
    main.py                  FastAPI app + routes
    config.py                env-driven config (DATA_DIR, SEED_*, RANDOM_SEED)
    db.py                    sqlite3 connection helper (WAL, FK on)
    seed.py                  Faker-driven synthetic data (retail/banking/telecom)
    cube.py                  Act 3 (slice/dice/drill/rollup/pivot)
    schemas_info.py          Act 4 (star/snowflake/galaxy + ROLAP/MOLAP/HOLAP)
    oltp_olap.py             Act 2 (point reads vs aggregates)
    sql_playground.py        Act 7 (read-only SELECT-only sandbox)
    medallion/
      pipeline.py            Bronze->Silver->Gold transforms + DQ events
      injectors.py           schema-drift / dupe-flood / null-flood / clean-stream
    mining/
      features.py
      techniques.py          classification / regression / clustering / association / anomaly
    finance/                 PLANNED — Act 9 CFO Lab (see Section 9)
  frontend/
    src/
      App.tsx                react-router routes for Overview + Act 1..8 (9 planned)
      acts/                  one file per act
      components/            ActHeader, Hero, Panel, DataTable, NavRail, ShortcutsModal, ...
      icons/                 inline SVG only (NO icon libs — see parent CLAUDE.md)
      lib/
    vite.config.ts           proxies /api -> :8000 in dev
  tests/
    conftest.py              isolated DB via DATA_DIR temp dir
    test_api.py
    test_medallion.py
    test_mining.py
    test_sql_playground.py
docs/                         lecture deck + syllabus PDF (read for context, do not edit)
Dockerfile                    multi-stage: node build -> python runtime
docker-compose.yml            named volume `dataai_sqlite` so down doesn't lose state
railway.json                  Railway picks up Dockerfile automatically
notebooks/                    PLANNED — Jupyter take-home notebook (see Section 9)
```

---

## 6. Conventions for this project

### Backend (Python / FastAPI)

- One module per act under [`app/backend/`](app/backend). Keep act files small. Cross-act helpers go in `db.py`, `config.py`.
- All SQL goes through [`db.connection()`](app/backend/db.py) (autocommit, WAL, FK on, `Row` factory). Do not open raw `sqlite3.connect` calls in act modules — except [sql_playground.py](app/backend/sql_playground.py), which intentionally uses a `mode=ro` URI for the playground.
- Route handlers stay thin. Business logic lives in act modules. Pydantic models are defined inline in [main.py](app/backend/main.py) when only one route uses them.
- All seeded data must be deterministic given `RANDOM_SEED`. Seed `random` and Faker explicitly.
- Errors surfaced to the UI: return `{"error": "..."}` from act modules (see [sql_playground.py:84-105](app/backend/sql_playground.py#L84-L105)) or raise `HTTPException` for HTTP-level failures. Never let a stack trace reach the SPA — the frontend has no error boundary on stage.
- Type hints required on public functions. `from __future__ import annotations` at the top of every backend file.

### Frontend (React / TS / Tailwind)

- One file per act in [`src/acts/`](app/frontend/src/acts). Wire it into [App.tsx](app/frontend/src/App.tsx) and the [NavRail](app/frontend/src/components/NavRail.tsx).
- **Inline SVG only.** No `lucide-react`, no `heroicons`, no `react-icons`. Drop new icons into [`src/icons/`](app/frontend/src/icons/index.tsx) and import from there. (Parent rule, repeated here because it bites.)
- Tailwind utility classes in JSX. Reach for [`styles.css`](app/frontend/src/styles.css) only for genuine cross-cutting CSS.
- Charts: prefer **Recharts** for standard bars/lines/pareto. Use **D3** only when Recharts can't express the layout (e.g., the bubble chart in Act 1, force-directed in Act 4). Use **React Flow** for the schema diagrams in Act 4. Use **Three.js / R3F** only for the cube in Act 3.
- Animations: **Framer Motion**. No CSS keyframes for anything that needs to stay performant on a projector.
- Code editor (SQL): **Monaco** (already vendored). Configure as read-only when not the playground.
- Vite manualChunks split is set up in [vite.config.ts](app/frontend/vite.config.ts) so heavy deps (three, monaco, recharts, framer) lazy-load. Keep new heavy deps out of the main bundle.
- TypeScript strict-ish: `tsc --noEmit` runs in `npm run build`. Any new types must compile.

### Tests

- Pytest only. Tests live under [`app/tests/`](app/tests).
- Test isolation: [conftest.py](app/tests/conftest.py) sets `DATA_DIR` to a temp dir and re-seeds with reduced row counts before any test runs. Do not write tests that depend on a specific `medallion.db` file path.
- New backend modules get a matching `test_<module>.py`. Per parent CLAUDE.md: "well-tested code is non-negotiable."
- Edge cases to always cover: empty result sets, idempotent re-runs, bad input rejected with a clear error.

---

## 7. The synthetic-data contract

- Data is **always** Faker-generated. Never check real customer/employee/financial data into this repo.
- The retail theme (slide 11: Ravi / Dubai Mall / iPhones) is the anchor. Banking and telecom overlays exist for variety in Acts 5–6 but reuse the same medallion plumbing.
- City/country mix is intentionally India-heavy with UAE (`Dubai`, `Abu Dhabi`, `Sharjah`) for the Amity audience.
- Brand/product names in [seed.py:22-33](app/backend/seed.py#L22-L33) are real names used as recognizable labels — that's fine for a teaching demo, but never tie them to fake performance metrics that could be misread as real-world claims.
- Seed scale knobs are env-driven ([config.py:11-17](app/backend/config.py#L11-L17)). Defaults are tuned for one laptop. Docker compose uses larger defaults.
- Boot logs visibly call out "default password active" / "synthetic data" — be loud about what's fake. (Parent rule: "Log loud warnings when defaults are in use.")

---

## 8. Adding a new act — checklist

1. Backend: new module under `app/backend/<act_name>/` (or a single file for small ones). Pure functions, deterministic.
2. Backend: routes in [main.py](app/backend/main.py) under a `# ----- Act N: <name> -----` banner, mirrored to the existing acts' style.
3. Frontend: new file `app/frontend/src/acts/Act<N><Name>.tsx`. Wire route in [App.tsx](app/frontend/src/App.tsx) and add a nav entry.
4. Tests: new `app/tests/test_<act_name>.py` covering happy path + 2-3 edge cases.
5. Docs: update [README.md](README.md) and the act table.
6. Shortcut key: bind to the digit (`9`, `0`) in [ShortcutsModal.tsx](app/frontend/src/components/ShortcutsModal.tsx) and the keyboard handler.
7. Smoke-test on `npm run dev` AND on a built bundle (`npm run build && uvicorn`). They behave differently for static asset paths.

---

## 9. Act 9 (in progress) — CFO Finance Lab + Ollama

A new end-to-end CFO storyline is being added as **Act 9**. It is additive — Acts 1–8 stay untouched. The full plan lives in conversation history; key constraints encoded here so future sessions don't re-litigate them:

- **Five-stage arc:** MESS → TRUST → DECIDE → PREDICT → ASK. One screen per stage.
- **Synthetic finance data:** 5 departments, 30 employees, 20 vendors, 12 months, ~2,000 rows total. Two raw "source" tables (Concur expenses + corporate card), three dims, one Silver, two Gold marts (`gld_spend_by_dept_month`, `gld_top_vendors`).
- **LLM provider is env-driven and swappable.** Default is local Ollama (`qwen2.5-coder:1.5b`), but the same code runs against Azure OpenAI / OpenRouter / NVIDIA NIM / OpenAI by changing env vars only. See Section 10 for the full contract.
- **Text-to-SQL safety:** schema-injected system prompt + few-shot examples + read-only SQL guard (reuses the [sql_playground.py](app/backend/sql_playground.py) `validate()` pattern). Reject non-SELECT before execution.
- **Notebook take-home:** `notebooks/cfo_finance_lab.ipynb` mirrors the Act 9 flow against `/api/finance/*` so students can re-run at home. Notebook reads the same `.env` so a student with an OpenRouter key can run it that way too.
- **Ollama bootstrap (default):** `scripts/setup_ollama.sh` installs Ollama if missing and pulls the model. Documented under "AI / LLM configuration" in README.

Stage demo guard for Act 9 specifically: warm up the active model on Act 9 mount (one throwaway prompt) so the first audience question doesn't pay the cold-start lag.

---

## 10. LLM configuration (env-driven, swappable, defaults to Ollama)

Every LLM-using module routes through **one client** (`app/backend/finance/llm_client.py`) that reads `.env` and speaks the **OpenAI-compatible Chat Completions API** shape. Ollama, OpenRouter, NVIDIA NIM, vLLM, and Azure OpenAI all speak it (Azure with a thin adapter). Changing providers is a `.env` change, never a code change.

### Standard env vars

| Var | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | One of: `ollama`, `openai`, `azure`, `openrouter`, `nvidia` |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible base URL. Ollama exposes `/v1` for compatibility. |
| `LLM_MODEL` | `qwen2.5-coder:1.5b` | Provider-specific model id. |
| `LLM_API_KEY` | `ollama` (placeholder) | Real key for cloud providers. |
| `LLM_TIMEOUT_SECONDS` | `30` | Hard timeout per call. |
| `LLM_TEMPERATURE` | `0.1` | Low for SQL generation. |
| `LLM_AZURE_DEPLOYMENT` | _(unset)_ | Required only when `LLM_PROVIDER=azure`. |
| `LLM_AZURE_API_VERSION` | _(unset)_ | Required only when `LLM_PROVIDER=azure`. |

### Provider examples (mirror these in `.env.example`)

```bash
# Ollama (default — local, free, offline-friendly)
# Tested defaults: qwen2.5-coder:1.5b (preferred) or llama3:latest (fallback if gemma4 isn't pulled)
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5-coder:1.5b
LLM_API_KEY=ollama

# OpenRouter (one key, hundreds of models)
LLM_PROVIDER=openrouter
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=meta-llama/llama-3.1-8b-instruct
LLM_API_KEY=sk-or-...

# Azure OpenAI (enterprise; uses deployment name as model)
LLM_PROVIDER=azure
LLM_BASE_URL=https://<resource>.openai.azure.com
LLM_MODEL=gpt-4o-mini
LLM_AZURE_DEPLOYMENT=my-gpt4o-mini
LLM_AZURE_API_VERSION=2024-08-01-preview
LLM_API_KEY=...

# NVIDIA NIM (self-hosted or build.nvidia.com)
LLM_PROVIDER=nvidia
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=meta/llama-3.1-8b-instruct
LLM_API_KEY=nvapi-...

# OpenAI (vanilla)
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-...
```

### Rules for AI code in this repo

- **One client.** All LLM calls go through `llm_client.py`. Act modules never import `httpx`/`requests` to talk to a provider directly. No scattered `import ollama` or `import openai`.
- **No hardcoded provider settings.** If you need a knob, add an env var and document it here + in `.env.example`.
- **Default config must work with zero keys.** Fresh clone + Ollama running locally + `qwen2.5-coder:1.5b` pulled = working Act 9. Cloud providers are opt-in via `.env`.
- **Ollama runs on the host, not inside the Docker image.** Container reaches Ollama via `host.docker.internal:11434` (Mac/Windows) or the host gateway IP on Linux. The `LLM_BASE_URL` env var handles this.
- **Timeouts and graceful fallback.** On timeout, return `{"error": "model is warming up, try again"}` to the UI — never let a stage demo hang.
- **Prompt construction.** Schema chunk (static dict, not DB-introspected at request time) + few-shot examples + user question. Same prompt shape regardless of provider.
- **Output guard.** Generated SQL goes through the same `validate()` regex used by [sql_playground.py:72](app/backend/sql_playground.py#L72) before execution. Read-only mode connection enforces it at the SQLite level too.
- **Secrets.** Real API keys never enter Git. `.env` is gitignored; `.env.example` carries placeholders. Per parent CLAUDE.md secrets rules.

---

## 11. Running things

### Local dev (two terminals)

```bash
# backend
cd app/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend
cd app/frontend
npm install
npm run dev    # http://localhost:5173, /api proxied to :8000
```

### Tests

```bash
cd app
pip install -r backend/requirements.txt pytest
pytest tests/
```

### Docker (single container)

```bash
docker compose up --build      # http://localhost:8000
docker compose down            # keeps the named volume `dataai_sqlite`
docker compose down -v         # explicit wipe
```

### Ollama (Act 9 default)

```bash
brew install ollama && ollama serve &
ollama pull qwen2.5-coder:1.5b      # preferred default
# alternative if gemma4 isn't available on your machine:
ollama pull llama3:latest

# verify
curl http://localhost:11434/api/tags
```

To switch the running app to llama3 without code changes, set `LLM_MODEL=llama3:latest` in `.env` and restart. To switch off Ollama entirely, change `LLM_PROVIDER` and friends per Section 10.

### Reset on stage

```bash
curl -X POST http://localhost:8000/api/reset
```

---

## 12. Deploy notes (Railway)

- Single container. Dockerfile is multi-stage (Node build → Python runtime). Static React assets are baked in and served by FastAPI.
- **SQLite is ephemeral on Railway** — `/app/data` is not a persistent volume. That is intentional: every Railway deploy starts with a clean seed. `/api/reset` is the recovery path if a student session leaves the warehouse in a weird state.
- **Ollama does not run on Railway.** Act 9 text-to-SQL is local-only by design. The Railway deploy works for Acts 1–8; Act 9's chat panel should detect missing Ollama and render a "run locally for full experience" empty state instead of erroring.
- Healthcheck hits `/api/health` (Dockerfile sets it; Railway picks it up).
- `CORS allow_origins=["*"]` is intentional — student demo, public by design ([main.py:42](app/backend/main.py#L42)). Do not lock it down "for production" — there is no production.

---

## 13. Don't do

- Don't add icon libraries. Inline SVG only. (Parent rule, but it gets violated.)
- Don't add a real database (Postgres/MySQL/etc.). SQLite is the deliberate choice for portability and one-file demos.
- Don't add auth/login flows. There is no user model. Adding auth breaks the "open the URL and click around" promise.
- Don't add cloud LLMs / API keys / external inference. Local Ollama only.
- Don't introduce non-deterministic seeding. The lecture must be reproducible across boots.
- Don't add backwards-compatibility shims for removed acts/endpoints. There are no external consumers — just delete the old code.
- Don't write multi-paragraph docstrings or sprawling comments. One short line max. Per parent CLAUDE.md and the codebase's existing voice.
- Don't add CI / GitHub Actions / linters / pre-commit hooks unless explicitly asked. The audience is one classroom, not a team.
- Don't optimize for production scale. Optimize for "Vishal's MacBook handles 30 students hitting it at once for 60 minutes."

---

## 14. Useful pointers

- Lecture deck and syllabus: [docs/](docs/) (PDFs — read for context before changing teaching content).
- Auto-memory for this project: [`~/.claude/projects/-Users-vishalmishra-workspace-self-DataAI-Amity/memory/MEMORY.md`](../../.claude/projects/-Users-vishalmishra-workspace-self-DataAI-Amity/memory/MEMORY.md).
- Cross-project rules: [../CLAUDE.md](../CLAUDE.md).
- Existing API surface to mimic when adding routes: [main.py](app/backend/main.py).
- SQL safety pattern to reuse for text-to-SQL: [sql_playground.py](app/backend/sql_playground.py).
- Medallion idempotency pattern to reuse: [medallion/pipeline.py](app/backend/medallion/pipeline.py).
