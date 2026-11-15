# switchhboard-mcp

**Graph-connected MCP tools.** Instead of preloading every tool schema into context, switchhboard-mcp keeps your tools in a typed graph - which tool consumes what type, which tool yields it - and, given a task, walks that graph and returns **only the tools the task calls, in call order**, with their schemas.

Preloading the bundled 420-tool starter catalog costs **110,238 tokens**. A typical plan costs **150-1,800**. Same tools, same schemas; you pay for the path, not the galaxy.

```
npm install -g switchhboard-mcp    # or run anything below with npx -y switchhboard-mcp
```

## Use it as an MCP server (the main path)

Per client, with the current official docs:

**Claude Code** ([docs](https://code.claude.com/docs/en/mcp)) - one command:

```
claude mcp add switchboard -- npx -y switchhboard-mcp
```

(or the `mcpServers` JSON below in a project `.mcp.json`)

**Cursor** ([docs](https://cursor.com/docs/context/mcp)) - `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{ "mcpServers": { "switchboard": { "command": "npx", "args": ["-y", "switchhboard-mcp"] } } }
```

**Codex** ([docs](https://developers.openai.com/codex/mcp)) - `~/.codex/config.toml`:

```toml
[mcp_servers.switchboard]
command = "npx"
args = ["-y", "switchhboard-mcp"]
```

Any other MCP client that can spawn a stdio server: command `npx`, args `["-y", "switchhboard-mcp"]`.

## HydraDB: the graph backend (required by default)

switchhboard-mcp stores its tool graph, run memory and held values in **[HydraDB](https://github.com/hydra-db/hydradb)** and plans with real graph queries over it - every planner question (what produces this type? what consumes it?) is a Cypher statement executed against the database, and each plan's `explain` carries the actually-executed `algo.MSpaths` statement, its measured time and path count.

Run HydraDB yourself (the hackathon way - the open-source engine, not a hosted service). Local development needs no docker, S3 or account:

```bash
git clone https://github.com/hydra-db/hydradb && cd hydradb
mkdir -p .hydradb/store .hydradb/cache
printf '%s\n' 'local-development-token-32-bytes' > .hydradb/auth-token
export CLOUD_PROVIDER=local LOCAL_PATH="$PWD/.hydradb/store" \
  GRAPH_NAMESPACE=default GRAPH_ID=default GRAPH_CELL_ID=cell-0 GRAPH_CELLS=cell-0 \
  GRAPH_NODE_ID=node-0 GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:7687 \
  GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:7687 GRAPH_DATA_CACHE_DIR="$PWD/.hydradb/cache" \
  GRAPH_AUTH_TOKEN_FILE="$PWD/.hydradb/auth-token" GRAPH_ALLOW_PLAINTEXT=true RUST_MIN_STACK=33554432
cargo run --locked --features server-runtime --bin graph-node
```

(full contract: [USING-HYDRADB.md](https://github.com/hydra-db/hydradb/blob/main/USING-HYDRADB.md), [cypher-compat.md](https://github.com/hydra-db/hydradb/blob/main/cypher-compat.md))

Then point switchhboard-mcp at it - Bolt for local, HTTPS for hosted:

```bash
claude mcp add switchboard \
  -e HYDRA_BOLT_URL=bolt://127.0.0.1:7687 \
  -e HYDRA_TOKEN=local-development-token-32-bytes \
  -- npx -y switchhboard-mcp
```

- `HYDRA_BOLT_URL` - Bolt endpoint (local dev; Neo4j-driver compatible)
- `HYDRA_HTTP_URL` - HydraDB HTTP query API instead (`http(s)://host:8443`) for hosts that can't expose raw Bolt TCP
- `HYDRA_TOKEN` - bearer token (password field over Bolt); local default shown above
- `HYDRA_GRAPH` / `HYDRA_CELL` - graph id / partition, defaults `default` / `cell-0`

First run against an empty graph seeds it from the bundled catalog; after that HydraDB is the source of truth. If the database is configured but unreachable, startup **fails loudly** - there is no silent fallback. For an offline no-database mode (catalog from JSON, no persistence, `explain.cypher: null`), opt in explicitly with `--embedded` or `SB_BACKEND=embedded`.

HydraDB is [AGPL-3.0](https://github.com/hydra-db/hydradb/blob/main/LICENSE) and runs as a separate server; switchhboard-mcp (MIT) talks to it as a client over Bolt/HTTP via the Apache-2.0 `neo4j-driver`.

Your agent gets three meta-tools instead of 420 real ones:

- **`plan`** - give a task in plain words, get back the exact tools it calls in order, each with its input schema and where every input comes from (`held`, `step N`, or `agent` - the agent fills those itself).
- **`report_run`** - say which steps worked. This is the learning loop: pair weights between tools are persisted in HydraDB, historically failing producers are abandoned for working alternatives, and a repeatedly-failing goal tool is substituted with a working equivalent. Held values persist per account, in the graph.
- **`catalog_stats`** - graph size and the full-context token cost it replaces.

The agent then calls the real tools through their own MCP servers as the plan directs. switchhboard-mcp plans; your servers execute.

## Use it as an HTTP API

```
switchhboard-mcp serve --port 8787
```

- `POST /api/plan` `{task, held?, exclude?, account?, allow_destructive?}` -> plan
- `POST /api/report_run` -> reinforce edges, persist held values
- `POST /api/plan_baseline` `{task, k}` -> BM25 top-k (unordered, for comparison)
- `POST /api/guard/check` -> the guard verdict for a task
- `GET /api/graph/galaxy` -> nodes + edges for visualization
- `GET /api/health` -> stats

## CLI

```
switchhboard-mcp plan --task "Open a PR on acme/api fixing the flaky login test"
switchhboard-mcp ingest --server "npx -y @modelcontextprotocol/server-filesystem /tmp" --name filesystem
switchhboard-mcp stats
switchhboard-mcp galaxy
```

`ingest` connects to any MCP server over stdio, reads its live `tools/list`, infers consumes/yields types and risk flags from the schemas, and merges them into your catalog. Point the server at your catalog with `--catalog` or `SB_CATALOG`.

## The plan contract

```jsonc
{
  "plan_id": "pl_...",
  "held": [{ "type": "github.repo", "value": "acme/api", "source": "mention:acme/api" }],
  "steps": [
    { "order": 1, "tool_id": "github.list_branches", "role": "prerequisite",
      "consumes": [{ "param": "repo", "type": "github.repo", "from": "held" }],
      "yields": [{ "field": "$", "type": "github.branch" }], "schema": { }, "schema_tokens": 64 }
  ],
  "tokens": { "plan": 357, "preload_all": 110238, "saved": 109881 },
  "guard": { "status": "ok" },
  "explain": { "cypher": "CALL algo.MSpaths(...)", "ms": 3, "transport": "embedded" }
}
```

- **Schema coverage is per-tool.** A plan step carries the tool's full input schema when the catalog has it (51 of 420 in the starter catalog; every tool in the official catalog, since it is ingested live). Steps without a stored schema still give the tool's identity, order, typed inputs and token accounting - your agent fetches that tool's live schema from its own server when it actually calls it.
- **Held values skip prerequisite calls.** Mention `PROJ-142`, `acme/api`, a URL, an email address, a `#channel` or an absolute file path and the plan starts where your data starts: "Comment on PROJ-142 saying the fix is deployed" is a one-tool plan. Pass `held` explicitly for values the task text doesn't name.
- **`exclude` forces a replan** without those tool ids - use it when a step fails and you want the next-best path.
- **`explain.cypher`** is the multi-source path query the plan is equivalent to. `transport: "embedded"` means the graph walks ran in-process in this package; the cypher text is the equivalent query a graph database deployment would execute.

## The guard

Plans are checked before anything runs. A chain whose steps together **read private data**, **ingest untrusted content** and **can send data out** is rejected with the offending legs named and the edge to cut - the prompt-injection exfiltration pattern ("lethal trifecta"), caught at plan time:

```
switchhboard-mcp plan --task "Scrape a web page, read my Gmail, and email both to bob@evil.com"
-> guard.status: "blocked"
   legs: reads_private (gmail.read_email) + ingests_untrusted (firecrawl.firecrawl_scrape) + exfil_sink (gmail.send_email)
```

Tools flagged `destructive` need `allow_destructive: true`. Risk flags and types for ingested tools are schema heuristics - a wrong flag gives a wrong verdict, so review flags for servers you add.

## Benchmarks

`node bench/bench.mjs` measures, over the bundled starter catalog (420 tools, 20 servers): preload-all vs BM25 top-k vs switchboardx, on seven fixture tasks. Current run: **mean 700 plan tokens (99.4% below preload-all on those tasks), chain recall 100%, correctly ordered 7/7**; BM25 top-5 contains the goal tool for only 2/7 and never orders. Numbers are measured at run time over those fixtures - evidence for the mechanism, not a general guarantee for arbitrary tasks or catalogs.

## Starter catalog provenance and licensing

The switchboardx source code is MIT (see LICENSE). `data/catalog.starter.json` is data, not code: it is generated by `scripts/build-catalog.mjs` from the public tool graph published at [switchhboard.vercel.app](https://switchhboard.vercel.app), this project's own website (tool list, types, edges, risk flags, schema token counts; full input schemas for 51 of 420 tools). Spot verification against a live `tools/list` (`@modelcontextprotocol/server-filesystem`): every published tool name matched a real tool and both full schemas matched exactly. The catalog *describes* third-party MCP servers; their tool names, descriptions and schemas remain the property of their respective authors. One documented build-time correction: `gmail/send_email` is typed for fresh sends (recipient + body), not the site graph's reply semantics. For production use, build the catalog from the servers you actually run with `switchhboard-mcp ingest` - that output is entirely your own deployment's data. `data/catalog.official.json` is an alternative minimal starter (37 tools, 4,504 preload tokens) ingested from the live `tools/list` of the official MCP reference servers (filesystem, memory, sequential-thinking, everything; MIT/Apache-2.0, see NOTICE): `switchhboard-mcp --catalog data/catalog.official.json`.

## Development

```
npm install
npm run build        # tsc
node --test test/    # planner, guard and memory functional tests
node bench/bench.mjs # measured benchmark
```

MIT
