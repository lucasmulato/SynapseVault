# SynapseVault: The Semantic Second Brain

SynapseVault is a personal knowledge graph system designed to interrelate
ideas, projects, and tasks using a local-first architecture.

## Architecture

- **Storage**: PostgreSQL (Relational Graph Schema).
- **Gateway**: Node.js MCP Gateway — exposes the graph as MCP tools *and* as
  an HTTP REST API used by the UI. One process, two surfaces.
- **Interface**: React + D3.js Force-Directed Graph Dashboard.
- **Reasoning (optional)**: an OpenAI-compatible chat agent (Groq free tier
  by default — R$0). Disabled unless `LLM_API_KEY` is set.

## Services

| Service    | Port | Purpose                                        |
|------------|------|------------------------------------------------|
| `db`       | 5432 | PostgreSQL graph database                      |
| `api`      | 3000 | MCP stdio + HTTP REST (`/api/*`)               |
| `ui`       | 5173 | React dashboard (Vite dev server / production) |

## Getting Started

### 🐳 The Fast Way (Docker)

Ensure you have Docker installed, then run:

```bash
docker-compose up --build
```

This launches the database, API, and UI automatically.

- **UI**: http://localhost:5173
- **API**: http://localhost:3000

### 🛠️ The Manual Way (Local Development)

1. **Initialize the database**

   Ensure PostgreSQL is running locally, then initialize the schema:

   ```bash
   ./scripts/setup_local_db.sh
   ```

2. **Run the API (MCP + HTTP)**

   ```bash
   cd api
   cp .env.example .env   # edit if your DB is elsewhere
   npm install
   npm run build
   npm start
   ```

3. **Run the Visual Dashboard (UI)**

   ```bash
   cd ui
   cp .env.example .env   # optional
   npm install
   npm run dev
   ```

4. **Enable the Chat Agent (Optional, free)**

   Create a free API key at [groq.com](https://console.groq.com), then add it
   to `api/.env`:

   ```bash
   LLM_API_KEY=gsk_...
   ```

   Restart the gateway — the chat button in the UI becomes active and can
   create/search nodes on your behalf. Any OpenAI-compatible provider works
   via `LLM_BASE_URL` / `LLM_MODEL`.

## Dashboard Features

- **Visual Graph**: Interactive D3-powered visualization of your second brain.
- **Node Categories**:
  - 🔵 **Ideas**: Raw concepts and insights.
  - 🟢 **Projects**: Structured collections of work.
  - 🟠 **Tasks**: Actionable items.
- **Interrelation**: Direct visual mapping of how projects contain tasks and
  ideas relate to each other; edges show their relationship labels.
- **Add Nodes**: Click the `+` in the sidebar to create a node from the UI;
  changes appear live on the graph.
- **Connect Nodes**: Click the link icon in the sidebar, pick source node →
  relationship label → target node to create an edge.
- **Persistent Layout**: Drag nodes into place — positions survive reloads.
- **Chat (optional)**: The chat button talks to an LLM agent that can create
  and search nodes for you. Free via Groq; disabled without an API key.

## API Reference

The gateway exposes the same logic over MCP stdio and HTTP REST:

| Method | Path                | Description                                        |
|--------|---------------------|----------------------------------------------------|
| GET    | `/api/health`       | Health check                                       |
| GET    | `/api/graph`        | All nodes + edges for visualization               |
| POST   | `/api/nodes`        | Create a node (`type`, `name`, ...)               |
| PATCH  | `/api/nodes/:id`    | Merge `properties` into an existing node          |
| POST   | `/api/edges`        | Create an edge (`source_id`, `target_id`, `label`) |
| GET    | `/api/search`       | Search nodes by `query` and/or `type`             |
| GET    | `/api/chat/status`  | Whether the optional chat agent is configured     |
| POST   | `/api/chat`         | Chat with the agent (`message`)                   |

Mutating routes are rate limited (60 requests/min/IP) and validated with zod.

## Development

- **Lint**: `cd ui && npm run lint`
- **Type-check + build API**: `cd api && npm run build`
- **Smoke tests** (requires Docker/podman): `./scripts/smoke_test.sh` spins up
  an ephemeral Postgres and verifies the full HTTP round-trip.
- **CI**: `.github/workflows/ci.yaml` runs API build + smoke tests + UI
  lint/build on every push and pull request.

## License

MIT License. Created by Lucas Mulato.