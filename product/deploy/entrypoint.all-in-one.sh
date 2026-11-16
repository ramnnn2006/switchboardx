#!/bin/sh
# All-in-one entrypoint: start HydraDB graph-node (loopback HTTP only), wait
# for health, seed nothing (the API seeds the catalog on boot), then run the
# switchhboard-mcp API as the public service on $PORT.
# Listener env names verified against scripts/runtime_smoke.sh at
# hydra-db/hydradb v0.4.0 (GRAPH_HTTP_ADDR / GRAPH_ADMIN_ADDR / GRAPH_BOLT_ADDR).
set -eu
: "${GRAPH_AUTH_TOKEN_VALUE:?set GRAPH_AUTH_TOKEN_VALUE}"
umask 077
printf '%s\n' "$GRAPH_AUTH_TOKEN_VALUE" > "${GRAPH_AUTH_TOKEN_FILE:-/data/auth-token}"

export CLOUD_PROVIDER="${CLOUD_PROVIDER:-local}"
export LOCAL_PATH="${LOCAL_PATH:-/data/store}"
export GRAPH_NAMESPACE="${GRAPH_NAMESPACE:-default}"
export GRAPH_ID="${GRAPH_ID:-default}"
export GRAPH_CELL_ID="${GRAPH_CELL_ID:-cell-0}"
export GRAPH_CELLS="${GRAPH_CELLS:-cell-0}"
export GRAPH_NODE_ID="${GRAPH_NODE_ID:-node-0}"
export GRAPH_DATA_CACHE_DIR="${GRAPH_DATA_CACHE_DIR:-/data/cache}"
export GRAPH_AUTH_TOKEN_FILE="${GRAPH_AUTH_TOKEN_FILE:-/data/auth-token}"
export GRAPH_ALLOW_PLAINTEXT="${GRAPH_ALLOW_PLAINTEXT:-true}"
export RUST_MIN_STACK="${RUST_MIN_STACK:-33554432}"
# 512MB is shared with the Node API; keep the graph cache small (smoke-script value).
export GRAPH_DATA_CACHE_BYTES="${GRAPH_DATA_CACHE_BYTES:-67108864}"
# Everything loopback: only the Node API is public.
export GRAPH_HTTP_ADDR=127.0.0.1:8443
export GRAPH_ADMIN_ADDR=127.0.0.1:19090
export GRAPH_BOLT_ADDR=127.0.0.1:7687
export GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:7687
export GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:7687

graph-node &
GRAPH_PID=$!
trap 'kill "$GRAPH_PID" 2>/dev/null || true' EXIT

# Admin readiness responds with status 200/503 and an empty body.
i=0
while [ "$i" -lt 90 ]; do
  if node -e "fetch('http://127.0.0.1:19090/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    break
  fi
  i=$((i + 1))
  sleep 2
done
if [ "$i" -ge 90 ]; then
  echo "graph-node did not become healthy" >&2
  exit 1
fi

export HYDRA_HTTP_URL=http://127.0.0.1:8443
export HYDRA_TOKEN="$GRAPH_AUTH_TOKEN_VALUE"
exec node /app/dist/cli.js serve
