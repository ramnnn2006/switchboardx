import type { Catalog, ToolNode } from './types.js';
import { toolIndex } from './catalog.js';

/**
 * The planner's view of the tool graph. Both backends answer the same questions;
 * the embedded one answers from an in-memory index, the HydraDB one answers by
 * executing Cypher over Bolt for every call - planning decisions (which tools can
 * produce a missing input, which consume a held value) come from the database.
 */
export interface GraphView {
  allTools(): Promise<ToolNode[]>;
  consumersOf(type: string): Promise<ToolNode[]>;
  producersOf(type: string): Promise<ToolNode[]>;
  get(id: string): Promise<ToolNode | undefined>;
  size(): Promise<number>;
  preloadTokens(): Promise<number>;
}

/** Typed bipartite graph: Type -FEEDS-> Tool -YIELDS-> Type. */
export class ToolGraph implements GraphView {
  readonly tools: Map<string, ToolNode>;
  private feedsInto = new Map<string, ToolNode[]>(); // type -> tools consuming it
  private yieldsFrom = new Map<string, ToolNode[]>(); // type -> tools yielding it

  constructor(readonly catalog: Catalog, exclude: string[] = []) {
    const ex = new Set(exclude.map((e) => e.replace('.', '/')));
    const all = toolIndex(catalog);
    this.tools = new Map([...all].filter(([id]) => !ex.has(id)));
    for (const t of this.tools.values()) {
      for (const c of t.consumes) {
        if (!this.feedsInto.has(c.type)) this.feedsInto.set(c.type, []);
        this.feedsInto.get(c.type)!.push(t);
      }
      for (const y of t.yields) {
        if (!this.yieldsFrom.has(y.type)) this.yieldsFrom.set(y.type, []);
        this.yieldsFrom.get(y.type)!.push(t);
      }
    }
  }

  async allTools(): Promise<ToolNode[]> {
    return [...this.tools.values()];
  }
  async consumersOf(type: string): Promise<ToolNode[]> {
    return this.feedsInto.get(type) ?? [];
  }
  async producersOf(type: string): Promise<ToolNode[]> {
    return this.yieldsFrom.get(type) ?? [];
  }
  async get(id: string): Promise<ToolNode | undefined> {
    return this.tools.get(id);
  }
  async size(): Promise<number> {
    return this.tools.size;
  }
  async preloadTokens(): Promise<number> {
    return [...this.tools.values()].reduce((a, t) => a + t.schemaTokens, 0);
  }
}
