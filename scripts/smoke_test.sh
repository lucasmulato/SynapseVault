#!/usr/bin/env bash
# SynapseVault smoke test.
#
# Spins up an ephemeral PostgreSQL container and a fresh API process, then
# verifies the core round-trips over HTTP:
#   health -> add_node -> add_edge -> get_graph -> search -> patch properties
#
# Requires: docker, curl, node (to run the built API), and `npm run build`
# to have been executed in api/.
set -euo pipefail

CONTAINER="synapsevault-smoke-db"
API_PORT="${SMOKE_API_PORT:-3999}"
DB_PORT="${SMOKE_DB_PORT:-3998}"
BASE="http://localhost:${API_PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[smoke] starting ephemeral postgres on :${DB_PORT}..."
docker run -d --rm --name "$CONTAINER" \
  -e POSTGRES_DB=synapsevault \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p "${DB_PORT}:5432" \
  docker.io/library/postgres:15-alpine >/dev/null

for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[smoke] applying schema..."
schema_applied=0
for i in $(seq 1 30); do
  if docker exec -i "$CONTAINER" psql -U postgres -d synapsevault \
    <"${SCRIPT_DIR}/schema.sql" >/dev/null 2>&1; then
    schema_applied=1
    break
  fi
  sleep 1
done
[[ "$schema_applied" == "1" ]] || { echo "[smoke] FAIL: could not apply schema"; exit 1; }

echo "[smoke] starting API on :${API_PORT}..."
DATABASE_URL="postgresql://postgres:postgres@localhost:${DB_PORT}/synapsevault" \
HTTP_PORT="$API_PORT" node "${SCRIPT_DIR}/../api/build/index.js" &
API_PID=$!

for i in $(seq 1 20); do
  if curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$API_PID" 2>/dev/null; then echo "[smoke] API died at startup"; exit 1; fi
  sleep 0.5
done

fail() { echo "[smoke] FAIL: $1"; exit 1; }
assert() { # assert <description> <actual> <expected-substring>
  if ! grep -q "$3" <<<"$2"; then fail "$1 — got: $2"; fi
  echo "[smoke] ok: $1"
}

# 1. Health
health="$(curl -fsS "${BASE}/api/health")"
assert "health check" "$health" '"status":"ok"'

# 2. Add node
node_a="$(curl -fsS -X POST "${BASE}/api/nodes" \
  -H 'Content-Type: application/json' \
  -d '{"type":"idea","name":"Smoke Idea A","description":"first"}')"
id_a="$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$node_a")"
assert "add_node returns uuid id" "$node_a" "$id_a"

node_b="$(curl -fsS -X POST "${BASE}/api/nodes" \
  -H 'Content-Type: application/json' \
  -d '{"type":"task","name":"Smoke Task B"}')"
id_b="$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$node_b")"

# 3. Validation rejects bad input
bad_status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/nodes" \
  -H 'Content-Type: application/json' \
  -d '{"type":"not-a-type","name":""}')"
assert "invalid node rejected with 400" "$bad_status" "400"

# 4. Add edge
edge="$(curl -fsS -X POST "${BASE}/api/edges" \
  -H 'Content-Type: application/json' \
  -d "{\"source_id\":\"${id_a}\",\"target_id\":\"${id_b}\",\"label\":\"contains\"}")"
assert "add_edge returns label" "$edge" '"label":"contains"'

dup_status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/edges" \
  -H 'Content-Type: application/json' \
  -d "{\"source_id\":\"${id_a}\",\"target_id\":\"${id_b}\",\"label\":\"contains\"}")"
assert "duplicate edge rejected with 409" "$dup_status" "409"

# 5. Patch properties (position persistence path)
patched="$(curl -fsS -X PATCH "${BASE}/api/nodes/${id_a}" \
  -H 'Content-Type: application/json' \
  -d '{"properties":{"_x":123.5,"_y":42}}')"
assert "patch persists _x/_y" "$patched" '"_x":123.5'

# 6. Graph round-trip contains both nodes and the edge
graph="$(curl -fsS "${BASE}/api/graph")"
assert "graph has Smoke Idea A" "$graph" 'Smoke Idea A'
assert "graph has the edge" "$graph" '"label":"contains"'
node -e "
const g = JSON.parse(process.argv[1]);
if (g.nodes.length !== 2) process.exit(1);
if (g.edges.length !== 1) process.exit(1);
if (!g.nodes.some((n) => n.properties && n.properties._x === 123.5)) process.exit(1);
" "$graph" || fail "graph shape/positions wrong"
echo "[smoke] ok: graph round-trip shape correct"

# 7. Search
results="$(curl -fsS "${BASE}/api/search?query=Smoke")"
assert "search finds nodes" "$results" 'Smoke Task B'

typed="$(curl -fsS "${BASE}/api/search?type=idea")"
assert "search filters by type" "$typed" 'Smoke Idea A'
grep -q 'Smoke Task B' <<<"$typed" && fail "type filter leaked task" || true

echo "[smoke] ALL PASSED"
