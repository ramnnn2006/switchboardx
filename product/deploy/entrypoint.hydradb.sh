#!/bin/sh
# Render/free-host entrypoint for the HydraDB graph-node image (hydra-db/hydradb
# v0.4.0 Dockerfile graph-node stage: ENTRYPOINT /usr/local/bin/graph-node,
# EXPOSE 7687 8443 9090 9443). graph-node reads its bearer token from
# GRAPH_AUTH_TOKEN_FILE; hosts inject secrets as env vars, so write the file
# first. Render routes public HTTPS to $PORT; HydraDB's query API must listen
# there. Listener env vars verified from scripts/runtime_smoke.sh at
# hydra-db/hydradb v0.4.0: GRAPH_HTTP_ADDR / GRAPH_ADMIN_ADDR / GRAPH_BOLT_ADDR
# (there is no GRAPH_HTTP_PORT).
set -eu
: "${GRAPH_AUTH_TOKEN_VALUE:?set GRAPH_AUTH_TOKEN_VALUE}"
mkdir -p /data/store /data/cache
umask 077
printf '%s\n' "$GRAPH_AUTH_TOKEN_VALUE" > "${GRAPH_AUTH_TOKEN_FILE:-/data/auth-token}"
# Query API on Render's routed port, reachable at the edge over HTTPS.
export GRAPH_HTTP_ADDR="0.0.0.0:${PORT:-8443}"
# Admin stays loopback-only; Render never routes to it.
export GRAPH_ADMIN_ADDR="${GRAPH_ADMIN_ADDR:-127.0.0.1:19090}"
# Bolt is unused by the product over Render (HTTPS query API only); keep it loopback.
export GRAPH_BOLT_ADDR="${GRAPH_BOLT_ADDR:-127.0.0.1:7687}"
exec graph-node
