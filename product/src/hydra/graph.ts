import type { GraphView } from '../graph.js';
import type { ToolNode } from '../types.js';
import type { HydraStore } from './store.js';

/**
 * GraphView answered by live HydraDB queries. Every planner question - what
 * produces this type, what consumes it, what does this tool look like - is a
 * Cypher statement executed over Bolt. Results are cached for the lifetime of
 * one plan so a single plan never asks the same question twice.
 */
export class HydraGraph implements GraphView {
  private toolsCache?: ToolNode[];
  private producersCache = new Map<string, ToolNode[]>();
  private consumersCache = new Map<string, ToolNode[]>();
  private byId = new Map<string, ToolNode>();

  constructor(
    private store: HydraStore,
    private exclude: Set<string> = new Set(),
  ) {}

  private keep(t: ToolNode): boolean {
    return !this.exclude.has(t.id) && !this.exclude.has(t.id.replace('/', '.'));
  }

  private index(list: ToolNode[]): ToolNode[] {
    const out = list.filter((t) => this.keep(t));
    for (const t of out) this.byId.set(t.id, t);
    return out;
  }

  async allTools(): Promise<ToolNode[]> {
    if (!this.toolsCache) this.toolsCache = this.index(await this.store.readTools());
    return this.toolsCache;
  }

  async consumersOf(type: string): Promise<ToolNode[]> {
    if (!this.consumersCache.has(type)) this.consumersCache.set(type, this.index(await this.store.readConsumers(type)));
    return this.consumersCache.get(type)!;
  }

  async producersOf(type: string): Promise<ToolNode[]> {
    if (!this.producersCache.has(type)) this.producersCache.set(type, this.index(await this.store.readProducers(type)));
    return this.producersCache.get(type)!;
  }

  async get(id: string): Promise<ToolNode | undefined> {
    const sid = id.includes('/') ? id : id.replace('.', '/');
    if (this.byId.has(sid)) return this.byId.get(sid);
    if (!this.keep({ id: sid } as ToolNode)) return undefined;
    const t = await this.store.readTool(sid);
    if (t && this.keep(t)) this.byId.set(t.id, t);
    return t && this.keep(t) ? t : undefined;
  }

  async size(): Promise<number> {
    return (await this.allTools()).length;
  }

  async preloadTokens(): Promise<number> {
    return (await this.allTools()).reduce((a, t) => a + t.schemaTokens, 0);
  }
}
