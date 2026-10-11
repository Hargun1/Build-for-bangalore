# AGENTS.md — handoff for AI coding agents

Read this before changing anything. Last updated 2026-10-11 (commit `abb9aaa` on `main`).
User-facing docs are in `README.md`. In-depth engineering notes (design reasons, measurements, changelog) are on the owner's Notion page: https://app.notion.com/p/3f573094586e80afbdbde00e2e9cc607. Add a dated section there for each feature you finish.

## What this is

**PranexusAI**: a preventive-health web app for Bengaluru, built as a portfolio/resume project. It is a real app on free APIs only, with no mocked features. Owner: Hargun Madan (GitHub `Hargun1/Build-for-bangalore`).

| Part | Stack | Dev port | Path |
|---|---|---|---|
| Web app | React 18 + Vite, plain CSS (`client/src/styles/ui.css` design tokens), recharts, three.js / react-three-fiber | 3000 | `client/` |
| API | Node 20, Express, zod validation, Mongoose, helmet, express-rate-limit, JWT | 5001 | `server/` |
| AI service | Python 3.12, FastAPI, httpx, pydantic; stateless, private | 8000 | `ai-service/` |
| DB | MongoDB (Atlas M0 in prod; mongodb-memory-server when `MONGODB_URI` is empty) | | |

Request flow: browser → Node `/api/*` (auth, validation, DB) → AI service (requires the `X-Internal-Token` header) → Gemini / Groq / OpenRouter.
In production Node also serves `client/dist`. Deployment: `render.yaml` (two free Render web services); steps are in the README and on Notion.

## Rules (owner's standing instructions)

- **Free APIs only.** Gemini free tier is primary. Groq and OpenRouter are optional fallbacks. Also used: Open-Meteo, Open Food Facts, OpenStreetMap/Overpass, Nominatim, MedlinePlus (public domain), Web Push (VAPID).
- **Never commit or print secrets.** `server/.env`, `ai-service/.env` and `client/.env` are gitignored. They hold a real Gemini key, VAPID keys and an Atlas URI.
  - An old Gmail app password is in early git history; the owner was told to revoke it.
  - Scan diffs for keys before pushing (`AIza…`, `AQ.Ab8…`, `gsk_…`, `sk-or-…`).
- **Commits:** end every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (or your own model's attribution). Ask before pushing unless told to. The owner pushes to `main`, and Render deploys from `main`.
- **Medical safety is a hard requirement.** Emergencies are detected by deterministic rules *before* any model runs (`ai-service/app/safety.py`). The AI safety classifier can only make a verdict more severe (`combine()`), never downgrade it. Don't weaken this.
- **AI never decides numbers.** Risk scores, meal totals, lab statuses and goal limits are computed in code. The model only explains, extracts or classifies, and every AI answer reports which model produced it (`aiSource`, shown in the UI).
- Be honest in notes and UI. Label estimates as estimates, and record what you could not verify.

## Feature map (where things live)

| Feature | Client | Server | AI service |
|---|---|---|---|
| Auth (email OTP, Google, guest 24 h TTL) | `pages/Login,Register,VerifyEmail,ForgotPassword` | `routes/auth.js`, `models/User.js` | |
| Risk analysis (IDRS, Framingham BMI, ACC/AHA BP) | `pages/Dashboard` | `routes/health.js` | `app/risk.py`, `routers/risk.py` |
| Health chat (cited, streaming) | `components/Chat/ChatPanel.jsx`, `services/stream.js` | `routes/chat.js` (SSE relay) | `routers/chat.py`, `rag/`, `app/safety.py` |
| Lab report reader | `pages/Labs.jsx`, `utils/reportPages.js` (pdf.js) | `routes/labs.js`, `models/LabReport.js` | `app/labs.py` (catalogue + checks), `routers/labs.py` |
| Push reminders | `pages/Reminders.jsx`, `services/pushClient.js`, `public/sw.js`, `public/manifest.webmanifest` | `routes/reminders.js`, `jobs/reminders.js`, `services/push.js` | |
| 3D "glass body" | `pages/GlassBody.jsx`, `components/GlassBody/*` (`organInsights.js` maps data → organs) | | |
| Meal photo / grocery / barcode | `pages/Grocery.jsx` | `routes/nutrition.js` | `routers/vision.py`, `routers/nutrition.py` |
| Goals, Environment (AQI), Vitals, Doctors/triage, SOS | matching `pages/*` | matching `routes/*` | `routers/goals,exposome,triage.py` |
| Evals | | | `ai-service/evals/` (results in `evals/README.md`) |

Key mechanisms:

**LLM client — `ai-service/app/llm.py`**
- OpenAI-compatible calls with fallback across providers and models.
- Each Gemini model has its own daily quota, so a 429 rests only that model (parses "retry in …").
- `stream()` falls back only before the first token.
- `reasoning_effort`: `low` by default (`GEMINI_REASONING_EFFORT`); `minimal` for chat (`GEMINI_CHAT_REASONING_EFFORT`).
- A 400 retries once without the extra parameters.

**RAG — `ai-service/rag/`**
- 1,016 MedlinePlus topics / 2,972 passages in `rag/data/chunks.jsonl`.
- BM25 with Indian English / Hinglish query expansion (`EXPANSIONS`, `REPLACE`).
- Optional Gemini embeddings fused by RRF. `cited()` drops citation numbers the model invented.

**Chat SSE protocol** — events `delta`, `flag`, `done`, `error`. Text is held back until the safety verdict arrives (max 12 s).

**Labs** — the model copies only the printed table. `labs.py` then:
- matches names, blocking lookalikes (MCH, VLDL, direct bilirubin, urine glucose);
- converts units;
- rejects implausible values;
- prefers the lab's printed range over the fallback range;
- raises critical alerts.

Saving re-checks rows through `/labs/evaluate`, so statuses never come from the browser.

**Reminders**
- Times are `HH:MM` in India time.
- A 60 s tick in the Node process claims each slot atomically (`sentSlots`), so each is sent exactly once, with 30 min of catch-up after the server sleeps.
- Dead subscriptions (404/410) are deleted.
- Without VAPID keys in development, temporary keys are generated.

## Run, test, verify

```bash
npm run install:all
npm run dev                      # api :5001, web :3000, ai :8000
npm test                         # jest (server) + pytest (ai-service)
cd client && npx vite build      # must pass; CI runs all three (.github/workflows/ci.yml)
```

The Python venv is at the repo root: `.venv/Scripts/python.exe` (Windows). Current counts: **91 pytest, 51 jest**. Both suites are fully mocked (no network, no keys).

Evals (spend real quota): `cd ai-service && python -m evals.run --suite red_flags|red_flags_holdout|triage|retrieval --mode rules|ai|keyword|expanded|hybrid`.

### Environment gotchas (Windows + Git Bash)

- **Git Bash rewrites `/api` into `C:/Program Files/Git/api`.** Use a full URL instead, e.g. `VITE_API_URL=http://localhost:3100/api VITE_API_PROXY_TARGET=http://localhost:5055 npx vite --port 3100`. `client/.env` points at `:5001`.
- **`server/.env` has an Atlas SRV URI that fails DNS locally** (`querySrv ECONNREFUSED`). For local test runs, start with `MONGODB_URI= node server.js` (empty value = in-memory DB).
- **Don't edit Python or regex files with bash heredocs.** Escapes get mangled (`\n` and `\b` became real newlines and backspaces once). Write the file with an editor tool, or write a patch script to a file and run it.
- `sed -i` is fine for one-line JS edits. A heredoc whose content contains `'` inside `$(...)` or an odd quote can break the whole command.
- **Browser checks:** use Playwright-core with installed Chrome (`chromium.launch({ channel: "chrome" })`).
  - Automated Chrome never shows notifications on screen, and headless doesn't receive FCM pushes. Verify push on the server (`delivered: 1`) and unit-test `sw.js` instead.
  - Notifications must be granted in the context.
- The AI service needs `ai-service/.env` loaded (`set -a; . ./.env; set +a`) and the same `AI_INTERNAL_TOKEN` as Node.

## Status and open work

Done and on `main`:
- rebuild on real data;
- AI eval harness;
- cited RAG chat;
- streaming chat;
- lab report reader;
- glass-body redesign;
- push reminders;
- deploy config.

Open, roughly in priority order:
1. **Deploy** (owner action): Atlas network access `0.0.0.0/0`, Render Blueprint, then fill in the env vars listed in the README/Notion. After the first deploy, set `AI_SERVICE_URL` and `CLIENT_URL` and redeploy. The owner must revoke the old Gmail app password.
2. **Finish embeddings:** 302/1016 topics are done (`rag/data/embeddings.partial.json`, gitignored; the run is resumable).
   - Once the Gemini daily quota resets, run `cd ai-service && python -m rag.build --embed` (downloads the MedlinePlus XML; `--zip <path>` uses a local copy) with `GEMINI_API_KEY` exported.
   - Then run `python -m evals.run --suite retrieval --mode hybrid` and record the before/after numbers in `evals/README.md` and on Notion.
3. Recommended next features:
   - doctor-ready PDF summary (labs + vitals + risk on one page);
   - Hindi/Kannada chat;
   - observability dashboard (latency, errors, quota);
   - family profiles.
4. Known limits:
   - Lab reading takes ~30–45 s on gemini-3.8-flash (kept for accuracy).
   - flash-lite over-triages (documented in the evals).
   - Render free instances sleep, so a cron pinger is recommended.

## Conventions

- Match the surrounding style: short comments that explain *why*, zod schemas at the top of each route file, `asyncHandler` + `HttpError`, and `validate(schema, "params"|"query")`.
- Every new per-user model must be added to the account-deletion cascade in `server/routes/users.js`, and every query must be scoped by `userId`.
- New AI endpoints go under a router in `ai-service/app/routers/`, are registered in `main.py` with `dependencies=protected`, and are added to `server/services/aiService.js` and the jest mock in `server/tests/features.test.js`.
- UI: use the existing `ui-*` classes and CSS variables; it's dark theme only. Pages are lazy-loaded in `client/src/App.jsx`, and nav links live in `components/Shared/AppShell.jsx`.
- Add tests with every feature, plus a real end-to-end check where possible, and report honestly what wasn't verified.
