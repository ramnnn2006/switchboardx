/**
 * HydraDB backend: the tool graph, run memory and held values live in HydraDB
 * and every statement below is really executed over Bolt (neo4j-driver).
 *
 * All Cypher is written against HydraDB's documented OpenCypher subset
 * (cypher-compat.md / USING-HYDRADB.md):
 *  - node ids are non-negative integers (see ids.ts), strings live in properties
 *  - writes go through the two batch shapes: vertex upsert
 *    `UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Label, n.p = row.p`
 *    (exactly one label, first) and idempotent edge batch
 *    `UNWIND $rows AS row CREATE (a {id: row.src})-[:TYPE]->(b {id: row.dst})`
 *  - batches are chunked to 1000 rows (server admission limit is 1024)
 *  - reads are always anchored (label or id), directed, single relationship
 *    type, named RETURN columns, no count(DISTINCT ...)
 */
import type { Catalog, RunReport, ServerInfo, ToolNode } from '../types.js';
import { hydraId, heldKey, pairKey, serverKey, toolKey, typeKey } from './ids.js';

/** One executed statement: text + parameters + measured time. */
export interface ExecutedStatement {
  cypher: string;
  ms: number;
}

/** Minimal session surface so tests can substitute an emulator. */
export interface CypherRunner {
  run(cypher: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

const CHUNK = 1000;

export function chunk<T>(rows: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

const UPSERT_TOOL =
  'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Tool, n.sid = row.sid, n.name = row.name, n.server = row.server, n.description = row.description, n.consumes = row.consumes, n.yields = row.yields, n.risk = row.risk, n.schemaTokens = row.schemaTokens, n.schema = row.schema';
const UPSERT_TYPE = 'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Type, n.name = row.name';
const UPSERT_SERVER = 'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Server, n.sid = row.sid, n.url = row.url';
const UPSERT_PAIR = 'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Pair, n.prev = row.prev, n.next = row.next, n.ok = row.ok, n.fail = row.fail';
const UPSERT_HELD = 'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Held, n.account = row.account, n.type = row.type, n.value = row.value';
const APPEND_RUN = 'UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Run, n.at = row.at, n.task = row.task, n.plan_id = row.plan_id, n.steps = row.steps';
const EDGE_FEEDS = 'UNWIND $rows AS row CREATE (a {id: row.src})-[:FEEDS]->(b {id: row.dst})';
const EDGE_YIELDS = 'UNWIND $rows AS row CREATE (a {id: row.src})-[:YIELDS]->(b {id: row.dst})';
const EDGE_HAS = 'UNWIND $rows AS row CREATE (a {id: row.src})-[:HAS]->(b {id: row.dst})';

const TOOL_PROJECTION = 't.sid AS sid, t.name AS name, t.server AS server, t.description AS description, t.consumes AS consumes, t.yields AS yields, t.risk AS risk, t.schemaTokens AS schemaTokens, t.schema AS schema';
const READ_TOOLS = `MATCH (t:Tool) RETURN ${TOOL_PROJECTION}`;
const READ_TOOL_BY_SID = `MATCH (t:Tool) WHERE t.sid = $sid RETURN ${TOOL_PROJECTION}`;
const READ_PRODUCERS = `MATCH (t:Tool)-[:YIELDS]->(y:Type) WHERE y.name = $type RETURN ${TOOL_PROJECTION}`;
const READ_CONSUMERS = `MATCH (y:Type)-[:FEEDS]->(t:Tool) WHERE y.name = $type RETURN ${TOOL_PROJECTION}`;
const READ_SERVERS = 'MATCH (s:Server) RETURN s.sid AS sid, s.name AS name, s.url AS url';
const READ_PAIRS = 'MATCH (p:Pair) RETURN p.prev AS prev, p.next AS next, p.ok AS ok, p.fail AS fail';
const READ_HELD = 'MATCH (h:Held) RETURN h.account AS account, h.type AS type, h.value AS value';
const COUNT_TOOLS = 'MATCH (t:Tool) RETURN count(*) AS n';
const COUNT_EDGES = 'MATCH (a:Type)-[:FEEDS]->(t:Tool) RETURN count(*) AS n';

export class HydraStore {
  /** statements actually executed, newest last (diagnostics + explain) */
  readonly executed: ExecutedStatement[] = [];

  constructor(private runner: CypherRunner) {}

  static fromEnv(runner: CypherRunner): HydraStore {
    return new HydraStore(runner);
  }

  private async exec(cypher: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const started = Date.now();
    const rows = await this.runner.run(cypher, params);
    this.executed.push({ cypher, ms: Date.now() - started });
    if (this.executed.length > 50) this.executed.splice(0, this.executed.length - 50);
    return rows;
  }

  private async execBatch(cypher: string, rows: Record<string, unknown>[]): Promise<void> {
    for (const part of chunk(rows)) await this.exec(cypher, { rows: part });
  }

  /** true when the graph holds no :Tool nodes yet. */
  async isEmpty(): Promise<boolean> {
    const rows = await this.exec(COUNT_TOOLS);
    return Number(rows[0]?.n ?? 0) === 0;
  }

  /** Write a whole catalog: labels first (tools, types, servers), then edges. */
  async ingestCatalog(cat: Catalog): Promise<{ tools: number; edges: number }> {
    const toolRows = cat.tools.map((t) => ({
      id: hydraId(toolKey(t.id)),
      sid: t.id,
      name: t.name,
      server: t.server,
      description: t.description,
      consumes: JSON.stringify(t.consumes),
      yields: JSON.stringify(t.yields),
      risk: JSON.stringify(t.risk),
      schemaTokens: t.schemaTokens,
      schema: JSON.stringify(t.schema ?? null),
    }));
    const typeNames = [...new Set(cat.tools.flatMap((t) => [...t.consumes.map((c) => c.type), ...t.yields.map((y) => y.type)]))];
    await this.execBatch(UPSERT_TYPE, typeNames.map((name) => ({ id: hydraId(typeKey(name)), name })));
    await this.execBatch(UPSERT_SERVER, cat.servers.map((s) => ({ id: hydraId(serverKey(s.id)), sid: s.id, url: s.url ?? '' })));
    await this.execBatch(UPSERT_TOOL, toolRows);

    const feeds = cat.tools.flatMap((t) => t.consumes.map((c) => ({ src: hydraId(typeKey(c.type)), dst: hydraId(toolKey(t.id)) })));
    const yields = cat.tools.flatMap((t) => t.yields.map((y) => ({ src: hydraId(toolKey(t.id)), dst: hydraId(typeKey(y.type)) })));
    const has = cat.tools.map((t) => ({ src: hydraId(serverKey(t.server)), dst: hydraId(toolKey(t.id)) }));
    await this.execBatch(EDGE_FEEDS, feeds);
    await this.execBatch(EDGE_YIELDS, yields);
    await this.execBatch(EDGE_HAS, has);
    return { tools: toolRows.length, edges: feeds.length + yields.length + has.length };
  }

  private rowToTool(r: Record<string, unknown>): ToolNode {
    return {
      id: String(r.sid),
      server: String(r.server),
      name: String(r.name),
      description: String(r.description ?? ''),
      consumes: JSON.parse(String(r.consumes ?? '[]')),
      yields: JSON.parse(String(r.yields ?? '[]')),
      risk: JSON.parse(String(r.risk ?? '[]')),
      schemaTokens: Number(r.schemaTokens ?? 0),
      schema: r.schema && String(r.schema) !== 'null' ? JSON.parse(String(r.schema)) : undefined,
    };
  }

  /** Live neighborhood lookups - one executed query per call. */
  async readTools(): Promise<ToolNode[]> {
    return (await this.exec(READ_TOOLS)).map((r) => this.rowToTool(r));
  }

  async readTool(sid: string): Promise<ToolNode | undefined> {
    const rows = await this.exec(READ_TOOL_BY_SID, { sid });
    return rows.length ? this.rowToTool(rows[0]) : undefined;
  }

  async readProducers(type: string): Promise<ToolNode[]> {
    return (await this.exec(READ_PRODUCERS, { type })).map((r) => this.rowToTool(r));
  }

  async readConsumers(type: string): Promise<ToolNode[]> {
    return (await this.exec(READ_CONSUMERS, { type })).map((r) => this.rowToTool(r));
  }

  /** Rebuild the in-memory catalog from what HydraDB actually stores. */
  async loadCatalog(provenance: string): Promise<Catalog> {
    const tools = await this.readTools();
    const serverRows = await this.exec(READ_SERVERS);
    const servers: ServerInfo[] = serverRows.map((r) => ({ id: String(r.sid), name: String(r.name ?? r.sid), url: String(r.url ?? '') }));
    const types = [...new Set(tools.flatMap((t) => [...t.consumes.map((c) => c.type), ...t.yields.map((y) => y.type)]))].sort();
    return { generated_at: new Date().toISOString(), provenance, servers, types, tools };
  }

  /** Pair weights (run memory) from HydraDB. */
  async loadPairs(): Promise<Map<string, { ok: number; fail: number }>> {
    const rows = await this.exec(READ_PAIRS);
    return new Map(rows.map((r) => [`${r.prev}->${r.next}`, { ok: Number(r.ok ?? 0), fail: Number(r.fail ?? 0) }]));
  }

  async savePairs(pairs: Map<string, { ok: number; fail: number }>): Promise<void> {
    const rows = [...pairs].map(([k, v]) => {
      const [prev, next] = k.split('->');
      return { id: hydraId(pairKey(prev, next)), prev, next, ok: v.ok, fail: v.fail };
    });
    await this.execBatch(UPSERT_PAIR, rows);
  }

  async loadHeld(): Promise<Record<string, Record<string, string>>> {
    const rows = await this.exec(READ_HELD);
    const out: Record<string, Record<string, string>> = {};
    for (const r of rows) {
      const account = String(r.account);
      out[account] = out[account] ?? {};
      out[account][String(r.type)] = String(r.value);
    }
    return out;
  }

  async saveHeld(account: string, held: { type: string; value: string }[]): Promise<void> {
    await this.execBatch(UPSERT_HELD, held.map((h) => ({ id: hydraId(heldKey(account, h.type)), account, type: h.type, value: h.value })));
  }

  async appendRun(rep: RunReport): Promise<void> {
    const at = new Date().toISOString();
    const id = hydraId(`run:${at}:${Math.random().toString(36).slice(2)}`);
    await this.execBatch(APPEND_RUN, [{ id, at, task: rep.task ?? '', plan_id: rep.plan_id ?? '', steps: JSON.stringify(rep.steps) }]);
  }

  /** Real graph-side path search: held types -> goal target types over FEEDS/YIELDS. */
  mspathsStatement(heldTypes: string[], targetTypes: string[]): string {
    const q = (s: string) => `'${s.replace(/'/g, "\\'")}'`;
    return `CALL algo.MSpaths({sourceLabel: 'Type', sourceProperty: 'name', sourceValues: [${heldTypes.map(q).join(', ')}], targetLabel: 'Type', targetProperty: 'name', targetValues: [${targetTypes.map(q).join(', ')}], relTypes: ['FEEDS', 'YIELDS'], relDirection: 'outgoing', maxLen: 8, pathCount: 3}) YIELD path, pathWeight RETURN path, pathWeight`;
  }

  async runMspaths(heldTypes: string[], targetTypes: string[]): Promise<{ cypher: string; ms: number; paths: number }> {
    const cypher = this.mspathsStatement(heldTypes, targetTypes);
    const started = Date.now();
    const rows = await this.exec(cypher);
    return { cypher, ms: Date.now() - started, paths: rows.length };
  }

  /** Wipe run-memory nodes (experiments need a clean learning state). */
  async clearMemory(): Promise<void> {
    await this.exec('MATCH (p:Pair) DETACH DELETE p');
    await this.exec('MATCH (h:Held) DETACH DELETE h');
    await this.exec('MATCH (r:Run) DETACH DELETE r');
  }

  async stats(): Promise<{ tools: number; feeds_edges: number }> {
    const t = await this.exec(COUNT_TOOLS);
    const e = await this.exec(COUNT_EDGES);
    return { tools: Number(t[0]?.n ?? 0), feeds_edges: Number(e[0]?.n ?? 0) };
  }

  async close(): Promise<void> {
    await this.runner.close();
  }
}

/** HydraDB typed-cell decoder for the HTTP query API. */
function decodeCell(cell: unknown): unknown {
  if (cell === null || typeof cell !== 'object') return cell;
  const c = cell as { type?: string; value?: unknown };
  if (c.type === 'null') return null;
  if (c.type === 'list' && Array.isArray(c.value)) return c.value.map(decodeCell);
  if (c.type === 'vertex_id' || c.type === 'integer' || c.type === 'float' || c.type === 'string' || c.type === 'boolean') return c.value;
  return c.value ?? null;
}

/**
 * HTTP runner over HydraDB's query API (POST /v1/graphs/{graph}/query). Use this
 * where Bolt's raw TCP port can't reach - e.g. HydraDB hosted behind HTTPS on a
 * web-service platform. Requires HYDRA_HTTP_URL; HYDRA_GRAPH (default "default")
 * and HYDRA_CELL (default "cell-0") select the graph and partition.
 */
export async function connectHttp(): Promise<{ store: HydraStore; url: string }> {
  const base = process.env.HYDRA_HTTP_URL!.replace(/\/$/, '');
  const token = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';
  const graph = process.env.HYDRA_GRAPH ?? 'default';
  const cell = process.env.HYDRA_CELL ?? 'cell-0';
  const endpoint = `${base}/v1/graphs/${encodeURIComponent(graph)}/query`;
  const runner: CypherRunner = {
    async run(cypher, params) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ cell_id: cell, query: cypher, parameters: params ?? {} }),
      });
      const payload: any = await res.json().catch(() => null);
      if (payload?.error) throw new Error(`HydraDB ${payload.error.code ?? res.status}: ${payload.error.message ?? res.statusText}`);
      if (!res.ok) throw new Error(`HydraDB HTTP ${res.status}: ${typeof payload === 'string' ? payload : res.statusText}`);
      if (!payload || !Array.isArray(payload.rows)) throw new Error(`HydraDB unexpected response shape (status ${res.status})`);
      const cols: string[] = payload.columns ?? [];
      return payload.rows.map((row: unknown[]) => {
        const o: Record<string, unknown> = {};
        cols.forEach((c, i) => (o[c] = decodeCell(row[i])));
        return o;
      });
    },
    async close() {},
  };
  // verify before handing out: a reachable port is not proof the database works
  await runner.run('MATCH (a {id: $src})-[:SMOKE]->(b) RETURN b.id AS id', { src: 999999999 });
  return { store: new HydraStore(runner), url: base };
}

/** Bolt runner over neo4j-driver (HydraDB speaks Bolt 5.x; token goes in the password field). */
export async function connectBolt(): Promise<{ store: HydraStore; url: string }> {
  const url = process.env.HYDRA_BOLT_URL!;
  const token = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';
  const database = process.env.HYDRA_GRAPH ?? 'default';
  const neo4j = (await import('neo4j-driver')).default;
  // HydraDB requires integer ids (cypher-compat.md); the JS driver packs plain
  // Numbers as Bolt Float, so every finite integer in the params must be
  // wrapped as a Bolt Integer. FNV-1a ids stay under 2^53, so this is exact.
  const ints = (v: unknown): unknown => {
    if (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 2 ** 53) return neo4j.int(v);
    if (Array.isArray(v)) return v.map(ints);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = ints(val);
      return o;
    }
    return v;
  };
  const open = () =>
    neo4j.driver(url, neo4j.auth.basic('neo4j', token), {
      disableLosslessIntegers: true,
      maxConnectionPoolSize: 8,
      connectionAcquisitionTimeout: 10000,
    });
  let driver = open();
  try {
    await driver.verifyConnectivity();
  } catch (first) {
    // a poisoned handshake must not kill the whole run: close and retry once
    await driver.close().catch(() => {});
    driver = open();
    try {
      await driver.verifyConnectivity();
    } catch (second) {
      await driver.close().catch(() => {});
      throw second;
    }
  }
  const runner: CypherRunner = {
    async run(cypher, params) {
      const session = driver.session({ database });
      try {
        const res = await session.run(cypher, (ints(params ?? {}) as Record<string, unknown>) ?? {});
        return res.records.map((rec) => {
          const o: Record<string, unknown> = {};
          for (const k of rec.keys) o[String(k)] = rec.get(k);
          return o;
        });
      } finally {
        await session.close();
      }
    },
    async close() {
      await driver.close();
    },
  };
  return { store: new HydraStore(runner), url };
}
