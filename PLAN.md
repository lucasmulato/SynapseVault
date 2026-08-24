# SynapseVault — Improvement Plan

> Living document. Last updated: 2026-08-23 (round 2).
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

## 5. Work completed (2026-08-23, round 2)

| Phase | What changed |
|-------|--------------|
| 0. Baseline | Untangled the inconsistent git index (files staged then deleted) and committed the round-1 refactor as one atomic commit after verifying API build + UI lint/build. |
| 1. Edge creation | Connect mode in `App.tsx`: pick source node → relationship label → target node → POST `/api/edges`. Graph is refetched after every mutation so edges render live; edge labels drawn at link midpoints. |
| 2. Layout persistence | Drag-end saves positions into node `properties._x/_y` via debounced PATCH `/api/nodes/:id`; saved nodes are pinned on load so layout survives reloads. d3 drag coords are now inverted through the zoom transform (fixes offset drags while zoomed). |
| 3. Hardening + tests | zod validation on all POST/PATCH bodies; fixed-window rate limit (60 mutations/min/IP); Postgres unique-violation now maps to 409. `scripts/smoke_test.sh` runs an ephemeral Postgres + API and verifies health → add_node → 400s → add_edge → duplicate 409 → position PATCH → graph shape → search; wired into `ci.yaml`. |
| 4. Agent | Deleted `scripts/deploy_agent.py` and all Vertex AI/GCP references (zero-cost requirement: R$0 budget, 4GB RAM laptop — local LLMs not viable). New optional agent (`api/src/services/agent.ts`): OpenAI-compatible chat-completions with a tool-calling loop over `add_node` / `add_edge` / `search_nodes`. Defaults to Groq free tier; entirely disabled unless `LLM_API_KEY` is set. UI chat panel wired to the previously dead MessageSquare button via `/api/chat/status` + `/api/chat`, refetching the graph when the agent mutates it. |

## 6. Verified

- `cd api && npm run build` and `cd ui && npm run lint && npm run build`.
- `./scripts/smoke_test.sh` — all assertions pass.
- Chat endpoints verified disabled-without-key path (503 + UI hint).

## 7. Open / next

- [ ] Verify add-node / connect flows end-to-end through Docker Compose on a
      real browser session.
- [ ] Node editing/deletion from the UI sidebar ("Edit Node" button is still
      a stub).
- [ ] Search UI: wire the Search button to `/api/search`.
- [ ] Optional token auth for non-localhost deployments.
- [ ] Consider SSE/WebSocket push instead of full graph refetch per mutation.

## 8. Conventions to keep

- One source of truth for graph logic (`api/src/services/vault.ts`) shared by
  both surfaces.
- Parameterized queries only — never interpolate user input into SQL.
- Relative API paths with a Vite proxy; no baking of `localhost` into env vars.
- `set -euo pipefail` in shell scripts.