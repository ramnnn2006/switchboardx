import type { Catalog, Plan, PlanRequest, RunReport } from './types.js';
import { loadCatalog, mergeCatalogs } from './catalog.js';
import { ToolGraph, type GraphView } from './graph.js';
import { HydraGraph } from './hydra/graph.js';
import { Planner } from './planner.js';
import { Memory } from './memory.js';
import { bm25TopK } from './baseline.js';
import { HydraStore, connectBolt, connectHttp } from './hydra/store.js';

export interface EngineOptions {
  catalogPath?: string;
  extraCatalogPath?: string;
  memoryDir?: string;
  /** explicit opt-in to the no-database mode; without it the engine requires HydraDB */
  embedded?: boolean;
  /** test hook: substitute a Cypher runner instead of opening a Bolt connection */
  hydraRunner?: import('./hydra/store.js').CypherRunner;
}

export const HYDRA_REQUIRED_MESSAGE =
  'switchhboard-mcp plans against a HydraDB graph. Set HYDRA_BOLT_URL (bolt://host:7687, local dev) or HYDRA_HTTP_URL (http(s)://host:8443, hosted/HTTPS) plus HYDRA_TOKEN - or run with --embedded / SB_BACKEND=embedded for the no-database offline mode.';

/**
 * HydraDB is the product backend: the tool graph, run memory and held values live
 * in HydraDB, and every planner question (what produces this type, what consumes
 * it, what does this tool look like) is a Cypher statement executed over Bolt.
 * Plan explain carries the actually-executed algo.MSpaths statement, its measured
 * time and its path count. If HYDRA_BOLT_URL is set but unreachable, startup
 * fails loudly - there is no silent fallback.
 *
 * The embedded mode (SB_BACKEND=embedded / --embedded) is an explicit offline
 * option: catalog from JSON, in-process graph walks, memory on disk, and
 * explain.cypher = null because no database is involved.
 */
export class SwitchboardEngine {
  catalog!: Catalog;
  readonly memory: Memory;
  readonly hydra?: HydraStore;
  readonly hydraUrl?: string;
  private readonly seedCatalog?: Catalog;

  private constructor(opts: EngineOptions, hydra?: HydraStore, hydraUrl?: string) {
    this.memory = new Memory(opts.memoryDir);
    this.hydra = hydra;
    this.hydraUrl = hydraUrl;
    const base = loadCatalog(opts.catalogPath);
    const merged = opts.extraCatalogPath ? mergeCatalogs(base, loadCatalog(opts.extraCatalogPath)) : base;
    if (hydra) {
      this.seedCatalog = merged;
      this.catalog = { servers: [], types: [], tools: [] };
    } else {
      this.catalog = merged;
    }
  }

  static async create(opts: EngineOptions = {}): Promise<SwitchboardEngine> {
    const embedded = opts.embedded || process.env.SB_BACKEND === 'embedded';
    if (embedded) return new SwitchboardEngine(opts);
    const boltUrl = process.env.HYDRA_BOLT_URL;
    const httpUrl = process.env.HYDRA_HTTP_URL;
    if (!boltUrl && !httpUrl && !opts.hydraRunner) throw new Error(HYDRA_REQUIRED_MESSAGE);
    let store: HydraStore;
    let url: string;
    try {
      if (opts.hydraRunner) {
        store = new HydraStore(opts.hydraRunner);
        url = boltUrl ?? httpUrl ?? 'emulated';
      } else if (boltUrl) {
        ({ store, url } = await connectBolt());
      } else {
        ({ store, url } = await connectHttp());
      }
    } catch (e) {
      throw new Error(`HydraDB is unreachable via ${boltUrl ?? httpUrl}: ${e instanceof Error ? e.message : e}. Start HydraDB or fix the URL/token; refusing to fall back to a database-less plan.`);
    }
    const engine = new SwitchboardEngine(opts, store, url);
    try {
      if (await store.isEmpty()) {
        // first run against a fresh graph: seed it from the bundled/merged catalog
        await store.ingestCatalog(engine.seedCatalog!);
      }
      await engine.syncFromHydra();
    } catch (e) {
      // never leak the driver/connection when seeding or the first read fails
      await store.close().catch(() => {});
      throw e;
    }
    return engine;
  }

  private makeGraph(exclude: string[]): GraphView {
    if (this.hydra) return new HydraGraph(this.hydra, new Set(exclude));
    return new ToolGraph(this.catalog, exclude);
  }

  /** Re-read run memory + held values from HydraDB (catalog stats read live). */
  async syncFromHydra(): Promise<void> {
    if (!this.hydra) return;
    this.memory.seedPairs(await this.hydra.loadPairs());
    this.memory.seedHeld(await this.hydra.loadHeld());
    this.catalog = await this.hydra.loadCatalog(`hydradb:${this.hydraUrl}`);
  }

  async plan(req: PlanRequest): Promise<Plan> {
    let planner: Planner;
    if (this.hydra) {
      // fresh run memory + held values, then plan entirely on live graph queries
      this.memory.seedPairs(await this.hydra.loadPairs());
      this.memory.seedHeld(await this.hydra.loadHeld());
    }
    planner = new Planner((exclude) => this.makeGraph(exclude), this.memory);
    const plan = await planner.plan(req);
    if (this.hydra) {
      const heldTypes = plan.held.map((h) => h.type);
      const targets = [...new Set(plan.steps.filter((s) => s.role === 'goal').flatMap((s) => s.yields.map((y) => y.type)))];
      if (heldTypes.length && targets.length) {
        const r = await this.hydra.runMspaths(heldTypes, targets);
        plan.explain = { cypher: r.cypher, ms: r.ms, transport: `hydra:${this.hydraUrl}`, paths: r.paths };
      } else {
        plan.explain = { cypher: null, ms: plan.explain.ms, transport: `hydra:${this.hydraUrl}` };
      }
    }
    return plan;
  }

  baseline(task: string, k = 5) {
    return { task, k, method: 'bm25(name+description), no graph', tools: bm25TopK(this.catalog, task, k) };
  }

  async reportRun(rep: RunReport) {
    const result = this.memory.reportRun(rep);
    if (this.hydra) {
      await this.hydra.appendRun(rep);
      await this.hydra.savePairs(this.memory.allPairs());
      if (rep.held?.length) await this.hydra.saveHeld(rep.account ?? 'default', rep.held);
    }
    return { ok: true, ...result };
  }

  async ingest(cat: Catalog): Promise<{ tools: number; edges: number }> {
    if (!this.hydra) throw new Error('ingest into a database requires HYDRA_BOLT_URL; in embedded mode, write a catalog JSON and pass --catalog');
    const r = await this.hydra.ingestCatalog(cat);
    await this.syncFromHydra();
    return r;
  }

  /** Graph export for explorers/UI: nodes + HAS/FEEDS/YIELDS edges. */
  galaxy() {
    const nodes: unknown[] = [];
    const edges: unknown[] = [];
    for (const s of this.catalog.servers) nodes.push({ id: `s:${s.id}`, kind: 'server', label: s.id });
    for (const ty of this.catalog.types) nodes.push({ id: `y:${ty}`, kind: 'type', label: ty });
    for (const t of this.catalog.tools) {
      nodes.push({ id: `t:${t.id}`, kind: 'tool', label: t.name, server: t.server, desc: t.description, risk: t.risk, consumes: t.consumes.map((c) => c.type), yields: t.yields.map((y) => y.type), schemaTokens: t.schemaTokens });
      edges.push([`s:${t.server}`, `t:${t.id}`, 'HAS']);
      for (const c of t.consumes) edges.push([`y:${c.type}`, `t:${t.id}`, 'FEEDS']);
      for (const y of t.yields) edges.push([`t:${t.id}`, `y:${y.type}`, 'YIELDS']);
    }
    return { generated_at: new Date().toISOString(), source: 'switchhboard-mcp', servers: this.catalog.servers, nodes, edges };
  }

  async stats() {
    const base: Record<string, unknown> = {
      tools: this.catalog.tools.length,
      types: this.catalog.types.length,
      servers: this.catalog.servers.length,
      preload_all_tokens: this.catalog.tools.reduce((a, t) => a + t.schemaTokens, 0),
      backend: this.hydra ? `hydradb:${this.hydraUrl}` : 'embedded',
    };
    if (this.hydra) base.hydradb = await this.hydra.stats();
    return base;
  }

  /** Clear persisted run memory (HydraDB mode); experiments use this for clean curves. */
  async clearMemory() {
    if (this.hydra) {
      await this.hydra.clearMemory();
      this.memory.seedPairs(new Map());
      this.memory.seedHeld({});
    }
  }

  async close() {
    await this.hydra?.close();
  }
}
