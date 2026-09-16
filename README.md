# Coach Running

A self-hosted running training tracker: plan and log training sessions, track VMA and heart-rate zones, exposed through a PWA, a REST API, and an MCP server so an AI coach can read and write sessions directly.

## Why

After [Garmin Bridge](https://github.com/Nem0oo/garmin-bridge), which exposes my Garmin health data to an AI agent, I was missing a place where that same agent could write my training plan instead of just reading it off screenshots. Coach Running is that place: a PWA to log and view my sessions, and an MCP server so the AI coach can create, update, and comment on my sessions directly.

## What it does

- Plan and track training sessions (type, state, content, date, coach comment)
- Track VMA (dated tests) and heart-rate zones
- Training stats over N weeks (by type, by state, total)
- Mobile-first installable PWA to view and log sessions
- Password + JWT authentication for the API and the PWA
- MCP server so an AI agent (coach) can read and write sessions directly

## Stack

| Component       | Technology |
|-----------------|------------|
| PWA             | React / Vite / Tailwind, served by Nginx (port 8888) |
| REST API        | Express / TypeScript, SQLite via better-sqlite3 (port 3001) |
| MCP server      | `@modelcontextprotocol/sdk` / Express (port 3002) |
| Database        | SQLite (`training.db`) |
| CI/CD           | GitHub Actions → Docker Hub |

## API endpoints

All endpoints (except `/api/health` and `/api/auth/login`) require an `Authorization: Bearer <token>` header obtained via login.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/api/health` | Health check (no auth) |
| `POST`   | `/api/auth/login` | Password login, returns a JWT (30d) |
| `GET`    | `/api/seances` | List sessions (filters: `from`, `to`, `type`, `etat`, `limit`) |
| `POST`   | `/api/seances` | Create a session |
| `GET`    | `/api/seances/:id` | Session detail |
| `PUT`    | `/api/seances/:id` | Update a session |
| `DELETE` | `/api/seances/:id` | Delete a session |
| `GET`    | `/api/stats` | Stats over N weeks (`?weeks=4`) |
| `GET`    | `/api/vma` | List VMA tests |
| `POST`   | `/api/vma` | Add a VMA test |
| `DELETE` | `/api/vma/:id` | Delete a VMA test |
| `GET`    | `/api/fc-zones` | List heart-rate zones |
| `POST`   | `/api/fc-zones` | Create a heart-rate zone |
| `PUT`    | `/api/fc-zones/:id` | Update a heart-rate zone |
| `DELETE` | `/api/fc-zones/:id` | Delete a heart-rate zone |
| `GET`    | `/api/power-zones` | List power zones (Z1-Z5, used by the scoring engine) |
| `POST`   | `/api/power-zones` | Create a power zone |
| `PUT`    | `/api/power-zones/:id` | Update a power zone |
| `DELETE` | `/api/power-zones/:id` | Delete a power zone |
| `GET`    | `/api/seances/:id/radar` | Per-session radar (3.1) — this session's 7-axis effect as internal proportions |
| `GET`    | `/api/radar-cumule` | Cumulative radar (3.2) — athlete-level EMA state on its own scale, never mix with 3.1 |

## MCP tools

The MCP server (`coach-running`) exposes the following tools to an AI agent, authenticated via `X-Api-Key`, `Authorization: Bearer`, or `?api_key=`:

| Tool | Description |
|------|--------------|
| `list_seances` | List sessions with optional filters |
| `get_seance` | Get a session's detail by id |
| `create_seance` | Create a new training session |
| `update_seance` | Update an existing session (partial fields) |
| `delete_seance` | Delete a session |
| `get_stats` | Training stats over N weeks |
| `list_fc_zones` | List heart-rate zones (read-only) |
| `list_power_zones` | List power zones Z1-Z5 used by the scoring engine (read-only) |
| `get_seance_radar` | Per-session radar (3.1), internal proportions |
| `get_radar_cumule` | Cumulative radar (3.2), EMA state — different scale than 3.1, never compare directly |

## Run locally

```bash
git clone <repo>
cd training
cp .env.example .env   # fill in API_PASSWORD, JWT_SECRET, MCP_API_KEY, INTERNAL_API_KEY
docker compose build
docker compose up
```

- PWA: http://localhost:8888
- API: http://localhost:3001
- MCP: http://localhost:3002

## Required environment variables

| Variable | Description |
|----------|-------------|
| `API_PASSWORD` | Password to log into the API/PWA |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `MCP_API_KEY` | API key to authenticate calls to the MCP server |
| `INTERNAL_API_KEY` | Shared secret for server-to-server calls: the MCP server proxies `create_seance`/`update_seance`/... to the API instead of writing to SQLite directly, so both channels run the exact same server code |
| `GARMIN_API_KEY` | API key for [garmin-bridge](https://github.com/Nem0oo/garmin-bridge) (separate service), used by the scoring engine to fetch activity data |
| `GARMIN_BASE_URL` | Base URL of your garmin-bridge instance (required, no default) |
| `PROD_URL` | Production domain, used in `mcp.json` to configure the MCP client |

## Required CI secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

## Notes

- Data is persisted in a single SQLite file (`training.db`), owned exclusively by the API service (`./data` volume). The MCP server has no filesystem access to it — every MCP tool that reads or writes a session calls the API internally (`X-Internal-Key` header, see `INTERNAL_API_KEY` above) so both channels run identical server code.
- The MCP server supports both the legacy SSE transport (`GET /sse`) and the Streamable HTTP transport (`POST /sse`, used by Claude.ai among others).
- `import_seances.py` bulk-imports a text training plan (`seances.txt`) into the database.

## Scoring séances

A fully deterministic (no ML) engine that scores a running session against what a Garmin activity actually recorded. Full spec lives in the "Course 2026-2027" project; this section documents what's implemented and its known modeling limits.

### How it works

1. **Trigger**: setting `garmin_activity_id` to a non-empty value on `create_seance`/`update_seance` — via the UI or MCP, both run the exact same code (`api/src/routes/seances.ts`) — fetches that activity from [garmin-bridge](https://github.com/Nem0oo/garmin-bridge) (`GARMIN_API_KEY`/`GARMIN_BASE_URL`) and runs the pipeline below. `condition_signalee: true` skips scoring entirely. There is no status field and no automatic retry: if the fetch fails (e.g. activity not synced yet on the Garmin side), the response carries a `scoring_error` message and the session write still succeeds — clear `garmin_activity_id` and set it again to retry.
2. **Segmentation** (`api/src/scoring/segmentation.ts`): the realized activity is cut into continuous, time-ordered intervals by `power_w` zone (never `hr_bpm` — heart rate lags too much for sub-minute intervals). Any interval under `min_interval_seconds` (60s, config) is dropped.
3. **Compliance** (`api/src/scoring/compliance.ts`): realized-vs-prescribed time per zone (✅/⚠️/❌ per zone, no single composite score), plus overall duration compliance. `power_w` is the only decisional signal; pace is informational only, never scored.
4. **Effect model** (`api/src/scoring/effect.ts`): converts each segment into a budget (`hours × poids_intensite[zone]`) and splits it across 7 axes (`endurance_fondamentale`, `seuil_lactique`, `vo2max`, `vma`, `resistance_musculaire`, `economie_course`, `resilience_thermique`) using the repartition table in `config/scoring.json`. `resistance_musculaire` is a per-segment carve-out driven by cumulative continuous-effort duration *before* that segment in the session — same zone/duration segment produces a different effect depending on where it falls in the session. Scaled by an execution factor (from compliance) and capped by an anti-outlier guard against a moving average of comparable recent sessions.
5. **Cumulative radar** (`api/src/scoring/ema.ts`): each scored session nudges a persistent 7-axis EMA state (`radar_cumule` table, `constante_temps_ema_jours` = 42 days). First-ever session seeds the state directly rather than starting from zero.
6. **Two radars, two scales, never mixed**: `GET /api/seances/:id/radar` (3.1) is this session's own 7 values normalized as internal proportions (what did *this* session emphasize). `GET /api/radar-cumule` (3.2) is the raw EMA state (where is fitness *now*).

### Config

`config/scoring.json`, mounted read-only into the `api` container (`SCORING_CONFIG_PATH`). Everything in it is an explicitly arbitrary starting point per the spec, meant to be recalibrated — edit the file on the host and `docker compose restart api`, no rebuild needed. Power zone thresholds (Z1-Z5, in W) live in the `power_zones` table instead (same pattern as `fc_zones`), editable from Réglages → Zones de puissance.

### Known, accepted limitations (not bugs)

- **Order is lost.** Segmentation only tracks total time per zone, never structure, rep count, or recovery between reps. A 3×(20s hard + 40s easy) warm-up block and a single 3-minute steady effort in the same zone score identically if their total zone-time matches.
- **`nature_effort` is session-wide, not per-block.** A short warm-up rep block on an otherwise continuous session is scored under the session's overall `nature_effort` even where it doesn't structurally match — marginal budget impact (~60s), damped further by the EMA.
- **`resistance_musculaire` ramp is a provisional guess**, calibrated on one data point from an unusually intense effort (marathon run near threshold) — likely underestimates real accumulated fatigue for genuine easy-effort (EF) volume. Needs the athlete's own recalibration once more sessions have been scored.
- **Table rows that don't sum to 100 were a spec bug, since fixed** — see `config/scoring.json`'s `repartition`; Z2's `endurance_fondamentale`/`resilience_thermique` are computed dynamically from temperature so they always sum to 100 by construction, every other row is a fixed 6-number split.
- **Power zones are maintained by hand**, deliberately decoupled from the Garmin-side power/zone profile — they don't update automatically if a threshold changes.
- **No retroactive correction of the cumulative radar.** If a session's scoring initially fails and is retried later (after other sessions have already been scored), the EMA is not replayed — it simply continues forward from the corrected value.
- **`categorie: 'autre'` has no defined scoring rule** — it produces an all-zero `effet_reel_brut` rather than skipping the calculation, so it's visibly "scored with nothing to show" rather than silently missing.
- **Compliance status thresholds and the plafond reference window** (`conformite_statuts`, `plafond_fenetre_seances` in config) aren't specified in the source spec — implemented with explicit, documented, easily-tunable defaults.

### Tests

`api/src/scoring/*.test.ts` — unit tests on synthetic data for segmentation (2.1), compliance (2.2), the effect model incl. the position-dependent `resistance_musculaire` carve-out and the anti-outlier cap (2.3), and the EMA update (2.4). Run with `npm test` inside the `api` container/image (no local Node install needed — `docker run --rm -v $(pwd)/api:/app -w /app node:20-alpine sh -c "npm install && npm test"`).
