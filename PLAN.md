# SynapseVault — Improvement Plan

> Living document. Last updated: 2026-08-23.
> This file is tracked in git so progress can be reviewed over time.

## 1. What we are building

A local-first personal knowledge graph ("second brain") with three layers:

1. **Storage** — PostgreSQL graph schema (`scripts/schema.sql`): `nodes`
   (Idea / Project / Task / Label) and `edges` (`relates_to` / `contains` /
   `depends_on` / `tagged_with`).
2. **Gateway** — Node.js MCP server (`api/src/index.ts`) that exposes the graph
   to agents over stdio **and** to the UI over HTTP REST on port 3000.
3. **Interface** — React + D3 force-directed dashboard (`ui/`).

Reasoning (Vertex AI) is an optional, separately-deployed component.

## 2. State of the repo before this round

The repo was functional but had drifted:

- Three disconnected surfaces: MCP stdio (port 3000), a dead FastAPI agent
  (port 8000), and a UI that only rendered mock data.
- CI referenced a `synapse-vault.yaml` pipeline file that did not exist.
- A stray GPG key and a compiled `api/build/index.js` were tracked.
- The UI env var baked `localhost:3000`, which is wrong inside Docker.
- `search_nodes` built SQL by string concatenation.
- `GraphView` assumed edge rows had `source`/`target`, but the DB returns
  `source_id`/`target_id`.

## 3. Work completed (2026-08-23)

| Phase | What changed |
|-------|--------------|
| 1. Dead weight | Deleted `api/agent.py`, `ui/src/lib/agent.ts`, `packages.microsoft.gpg`, tracked `api/build/index.js`, and the two broken GCP workflow files. |
| 2. Gateway | New shared `api/src/services/vault.ts` holds all query logic. `api/src/index.ts` now runs MCP stdio **and** an HTTP server (`/api/health`, `/api/graph`, `/api/nodes`, `/api/edges`, `/api/search`). Queries are parameterized (SQL injection fixed). Pinned `typescript@^5.8`, `@types/node@^22`, added `ts-node`. |
| 3. UI | `App.tsx` fetches `/api/graph` on mount and POSTs new nodes (replaces mock data). `GraphView.tsx` normalizes `source_id`/`target_id` rows into d3 links and exposes a clean component API. `vite.config.ts` proxies `/api` to the gateway. Dropped the misleading `VITE_API_URL` from `docker-compose.yml`. |
| 4. CI | New `.github/workflows/ci.yaml`: API `npm ci` + `npm run build`, UI `npm ci` + `npm run lint` + `npm run build`. No GCP dependency. |
| 5. Hygiene/docs | `.gitignore` cleaned (`api/build/`, `*.pgp`, `.venv/`, `*.tsbuildinfo`). `scripts/setup_local_db.sh` resolves `schema.sql` via `$(dirname "$0")` and passes `PGPASSWORD`. Added `api/.env.example`, `ui/.env.example`. Rewrote `README.md` to match reality. |

## 4. Verified

- `cd api && npm run build` — `tsc` passes with `strict: true`.
- `cd ui && npm run build` — `tsc -b && vite build` passes.
- `docker-compose up --build` — all three services come up; `/api/health` and
  `/api/graph` return data; graph renders nodes from PostgreSQL.

## 5. Open / next

- [ ] Wire the `+` add-node flow end-to-end through Docker (UI → proxy → API →
      Postgres) and confirm the new node appears live.
- [ ] Add edge creation from the UI (drag-to-connect or sidebar form).
- [ ] Persist graph layout (node positions) so it survives a reload.
- [ ] Replace the Vertex AI stub (`scripts/deploy_agent.py`) with a real agent
      that calls the MCP gateway tools.
- [ ] Add tests: a smoke test against a temporary Postgres verifying
      add_node → add_edge → get_graph round-trips.
- [ ] Harden: JWT/auth on the HTTP surface, request rate limiting, secrets
      management.
- [ ] Decide long-term: keep MCP stdio + HTTP in one process, or split into
      separate services.

## 6. Conventions to keep

- One source of truth for graph logic (`api/src/services/vault.ts`) shared by
  both surfaces.
- Parameterized queries only — never interpolate user input into SQL.
- Relative API paths with a Vite proxy; no baking of `localhost` into env vars.
- `set -euo pipefail` in shell scripts.