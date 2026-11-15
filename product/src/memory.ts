import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { RunReport } from './types.js';

/** Local persistent memory: run journal, tool-pair weights, saved held values. No account, no service. */
export class Memory {
  readonly dir: string;
  private pairs = new Map<string, { ok: number; fail: number }>();

  constructor(dir?: string) {
    this.dir = dir ?? join(homedir(), '.switchboardx');
    mkdirSync(this.dir, { recursive: true });
    this.load();
  }

  private load() {
    const p = join(this.dir, 'pairs.json');
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf8')) as Record<string, { ok: number; fail: number }>;
      this.pairs = new Map(Object.entries(raw));
    }
  }

  /** Replace in-memory pair weights (HydraDB backend seeds the cache from the graph). */
  seedPairs(pairs: Map<string, { ok: number; fail: number }>) {
    this.pairs = new Map(pairs);
  }

  allPairs(): Map<string, { ok: number; fail: number }> {
    return new Map(this.pairs);
  }

  private heldOverride: Record<string, Record<string, string>> | null = null;

  /** Replace in-memory held values (HydraDB backend seeds the cache from the graph). */
  seedHeld(all: Record<string, Record<string, string>>) {
    this.heldOverride = all;
  }

  private save() {
    writeFileSync(join(this.dir, 'pairs.json'), JSON.stringify(Object.fromEntries(this.pairs), null, 1));
  }

  /**
   * Weight for following prev with next: 1.0 = unknown, <1 = historically reliable,
   * >1 = historically failing (up to 0.4 in each direction). The >1 side is what
   * lets planning abandon a broken producer for an untried alternative.
   */
  pairWeight(prev: string | undefined, next: string): number {
    if (!prev) return 1;
    const p = this.pairs.get(`${prev}->${next}`);
    if (!p) return 1;
    const rate = p.ok / Math.max(1, p.ok + p.fail);
    return 1 + 0.8 * (0.5 - rate) * Math.min(1, (p.ok + p.fail) / 10);
  }

  /** Aggregate run history for a tool as the source of pairs: how often it fed later steps well vs badly. */
  historyOf(toolId: string): { ok: number; fail: number } {
    let ok = 0, fail = 0;
    for (const [k, v] of this.pairs) if (k.startsWith(`${toolId}->`)) { ok += v.ok; fail += v.fail; }
    return { ok, fail };
  }

  reportRun(rep: RunReport): { strengthened: string[] } {
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(join(this.dir, 'runs.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...rep }) + '\n');
    const strengthened: string[] = [];
    for (let i = 1; i < rep.steps.length; i++) {
      const key = `${rep.steps[i - 1].tool_id}->${rep.steps[i].tool_id}`;
      const p = this.pairs.get(key) ?? { ok: 0, fail: 0 };
      if (rep.steps[i].worked && rep.steps[i - 1].worked) p.ok += 1;
      else p.fail += 1;
      this.pairs.set(key, p);
      strengthened.push(key);
    }
    // a failed step failed to feed EVERYTHING downstream of it, not just its
    // neighbor: record fail pairs to every later step so planning can abandon
    // the failed producer when choosing what feeds a distant consumer.
    for (let i = 0; i < rep.steps.length; i++) {
      if (rep.steps[i].worked) continue;
      for (let j = i + 1; j < rep.steps.length; j++) {
        const key = `${rep.steps[i].tool_id}->${rep.steps[j].tool_id}`;
        const p = this.pairs.get(key) ?? { ok: 0, fail: 0 };
        p.fail += 1;
        this.pairs.set(key, p);
        if (!strengthened.includes(key)) strengthened.push(key);
      }
    }
    this.save();
    if (rep.held?.length) this.saveHeld('default', rep.held);
    return { strengthened };
  }

  saveHeld(account: string, held: { type: string; value: string }[]) {
    const p = join(this.dir, 'held.json');
    const all = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
    all[account] = { ...(all[account] ?? {}) };
    for (const h of held) all[account][h.type] = h.value;
    writeFileSync(p, JSON.stringify(all, null, 1));
  }

  heldFor(account: string): { type: string; value: string; source: string }[] {
    if (this.heldOverride) {
      return Object.entries(this.heldOverride[account] ?? {}).map(([type, value]) => ({ type, value, source: `memory:${account}` }));
    }
    const p = join(this.dir, 'held.json');
    if (!existsSync(p)) return [];
    const all = JSON.parse(readFileSync(p, 'utf8'));
    return Object.entries(all[account] ?? {}).map(([type, value]) => ({ type, value: value as string, source: `memory:${account}` }));
  }
}
