import type { Catalog } from './types.js';
import { dotted } from './catalog.js';

const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(Boolean);

/** BM25 top-k over name+description. No graph, no order: the comparison the bench table uses. */
export function bm25TopK(catalog: Catalog, task: string, k = 5): { tool_id: string; server_id: string; score: number }[] {
  const docs = catalog.tools.map((t) => ({ t, terms: tok(`${t.name} ${t.description}`) }));
  const N = docs.length;
  const avgdl = docs.reduce((a, d) => a + d.terms.length, 0) / Math.max(1, N);
  const df = new Map<string, number>();
  for (const d of docs) for (const term of new Set(d.terms)) df.set(term, (df.get(term) ?? 0) + 1);
  const q = new Set(tok(task));
  const k1 = 1.2, b = 0.75;
  const scored = docs.map((d) => {
    const tf = new Map<string, number>();
    for (const term of d.terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of q) {
      const n = df.get(term) ?? 0;
      if (!n) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const f = tf.get(term) ?? 0;
      score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.terms.length) / avgdl));
    }
    return { tool_id: dotted(d.t.id), server_id: d.t.server, score: Math.round(score * 10000) / 10000 };
  });
  return scored.filter((s) => s.score > 0).sort((a, b2) => b2.score - a.score).slice(0, k);
}
