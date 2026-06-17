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

## Run locally

```bash
git clone <repo>
cd training
cp .env.example .env   # fill in API_PASSWORD, JWT_SECRET, MCP_API_KEY
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
| `PROD_URL` | Production domain, used in `mcp.json` to configure the MCP client |

## Required CI secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

## Notes

- Data is persisted in a single SQLite file (`training.db`) shared by the API and the MCP server via the `./data` volume.
- The MCP server supports both the legacy SSE transport (`GET /sse`) and the Streamable HTTP transport (`POST /sse`, used by Claude.ai among others).
- `import_seances.py` bulk-imports a text training plan (`seances.txt`) into the database.
