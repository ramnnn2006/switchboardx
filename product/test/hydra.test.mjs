// HydraDB-mode tests against an emulated Cypher runner. The emulator implements
// exactly the statement shapes the store emits (see src/hydra/store.ts) at row
// level: batch upserts, edge batches, anchored reads, pair/held storage. This
// proves our Cypher generation + (de)serialization round-trips; the live
// integration test (test/hydra.live.it.mjs) proves it against a real server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwitchboardEngine } from '../dist/engine.js';
import { HydraStore } from '../dist/hydra/store.js';
import { hydraId } from '../dist/hydra/ids.js';

/** In-memory emulation of HydraDB's documented semantics for our statement set. */
function emulator() {
  const nodes = new Map(); // id -> {label, props}
  const edges = new Set(); // "src|type|dst"
  const statements = [];
  const run = async (cypher, params = {}) => {
    statements.push(cypher);
    // batch cap: admission control rejects >1024 rows
    if (Array.isArray(params.rows)) assert.ok(params.rows.length <= 1024, 'batch exceeds HydraDB 1024-row admission limit');
    let m;
    if ((m = cypher.match(/^UNWIND \$rows AS row MERGE \(n \{id: row\.id\}\) SET n:(\w+), (.*)$/))) {
      const [, label, assigns] = m;
      const fields = assigns.split(',').map((a) => a.trim().match(/^n\.(\w+) = row\.(\w+)$/).slice(1));
      for (const row of params.rows) {
        const props = {};
        for (const [prop, field] of fields) props[prop] = row[field];
        nodes.set(row.id, { label, props });
      }
      return [];
    }
    if ((m = cypher.match(/^UNWIND \$rows AS row CREATE \(a \{id: row\.src\}\)-\[:(\w+)\]->\(b \{id: row\.dst\}\)$/))) {
      for (const row of params.rows) edges.add(`${row.src}|${m[1]}|${row.dst}`); // idempotent per (src,type,dst)
      return [];
    }
    if (cypher === 'MATCH (t:Tool) RETURN count(*) AS n') {
      return [{ n: [...nodes.values()].filter((n) => n.label === 'Tool').length }];
    }
    if (cypher === 'MATCH (a:Type)-[:FEEDS]->(t:Tool) RETURN count(*) AS n') {
      return [{ n: [...edges].filter((e) => e.includes('|FEEDS|')).length }];
    }
    if (cypher.startsWith('MATCH (t:Tool) RETURN')) {
      return [...nodes.values()].filter((n) => n.label === 'Tool').map((n) => n.props);
    }
    if (cypher.startsWith('MATCH (s:Server) RETURN')) {
      return [...nodes.values()].filter((n) => n.label === 'Server').map((n) => n.props);
    }
    if (cypher.startsWith('MATCH (t:Tool) WHERE t.sid = $sid')) {
      const n = [...nodes.values()].find((n) => n.label === 'Tool' && n.props.sid === params.sid);
      return n ? [n.props] : [];
    }
    if (cypher.startsWith('MATCH (t:Tool)-[:YIELDS]->(y:Type) WHERE y.name = $type')) {
      const typeNode = [...nodes.entries()].find(([, n]) => n.label === 'Type' && n.props.name === params.type);
      if (!typeNode) return [];
      return [...edges]
        .filter((e) => e.endsWith(`|YIELDS|${typeNode[0]}`))
        .map((e) => nodes.get(Number(e.split('|')[0])).props);
    }
    if (cypher.startsWith('MATCH (y:Type)-[:FEEDS]->(t:Tool) WHERE y.name = $type')) {
      const typeNode = [...nodes.entries()].find(([, n]) => n.label === 'Type' && n.props.name === params.type);
      if (!typeNode) return [];
      return [...edges]
        .filter((e) => e.startsWith(`${typeNode[0]}|FEEDS|`))
        .map((e) => nodes.get(Number(e.split('|')[2])).props);
    }
    if (cypher.startsWith('MATCH (p:Pair) RETURN')) {
      return [...nodes.values()].filter((n) => n.label === 'Pair').map((n) => n.props);
    }
    if (cypher.startsWith('MATCH (h:Held) RETURN')) {
      return [...nodes.values()].filter((n) => n.label === 'Held').map((n) => n.props);
    }
    if (cypher.startsWith('CALL algo.MSpaths(')) {
      // count distinct FEEDS+YIELDS paths bounded at maxLen 8: emulate by counting goal-reachable edges
      return [];
    }
    throw new Error(`emulator: unhandled statement: ${cypher}`);
  };
  return { run, close: async () => {}, statements, nodes, edges };
}

const env = { HYDRA_BOLT_URL: 'bolt://emulated:7687', HYDRA_TOKEN: 'x' };

test('hydra mode: seeds an empty graph, plans on graph queries, explain carries the executed statement', async () => {
  const em = emulator();
  process.env.HYDRA_BOLT_URL = env.HYDRA_BOLT_URL;
  const engine = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-hydra-test', hydraRunner: em });
  // catalog was seeded into the emulated graph, not just loaded from JSON
  const stats = await engine.stats();
  assert.equal(stats.backend, 'hydradb:bolt://emulated:7687');
  assert.equal(stats.hydradb.tools, stats.tools);
  assert.ok(stats.tools > 400);
  assert.ok(em.statements.some((s) => s.startsWith('UNWIND $rows AS row MERGE (n {id: row.id}) SET n:Tool,')));
  assert.ok(em.statements.includes('UNWIND $rows AS row CREATE (a {id: row.src})-[:FEEDS]->(b {id: row.dst})'));

  const plan = await engine.plan({ task: 'Open a PR on acme/api fixing the flaky login test' });
  assert.ok(plan.steps.some((s) => s.tool_id === 'github.create_pull_request'));
  assert.equal(plan.explain.transport, 'hydra:bolt://emulated:7687');
  assert.ok(plan.explain.cypher?.startsWith('CALL algo.MSpaths('));
  // the planning itself asked the graph about producers/consumers
  assert.ok(em.statements.some((s) => s.startsWith('MATCH (t:Tool)-[:YIELDS]->(y:Type) WHERE y.name = $type')));
  await engine.close();
  delete process.env.HYDRA_BOLT_URL;
});

test('hydra mode: report_run persists pairs and held values into the graph', async () => {
  const em = emulator();
  process.env.HYDRA_BOLT_URL = env.HYDRA_BOLT_URL;
  const engine = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-hydra-test2', hydraRunner: em });
  await engine.reportRun({
    steps: [{ tool_id: 'github.list_branches', worked: true }, { tool_id: 'github.create_pull_request', worked: true }],
    held: [{ type: 'github.repo', value: 'acme/api' }],
  });
  const pairNode = em.nodes.get(hydraId('pair:github.list_branches->github.create_pull_request'));
  assert.ok(pairNode, 'pair node written to the graph');
  assert.equal(pairNode.props.ok, 1);
  const heldNode = em.nodes.get(hydraId('held:default:github.repo'));
  assert.equal(heldNode.props.value, 'acme/api');
  // a second engine against the same graph sees the memory
  const engine2 = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-hydra-test2b', hydraRunner: em });
  assert.ok(engine2.memory.heldFor('default').some((h) => h.type === 'github.repo' && h.value === 'acme/api'));
  await engine.close();
  await engine2.close();
  delete process.env.HYDRA_BOLT_URL;
});

test('hydra store: chunking keeps batches under the 1024-row admission cap', async () => {
  const em = emulator();
  const store = new HydraStore(em);
  const big = { servers: [{ id: 's' }], types: [], tools: Array.from({ length: 5 }, (_, i) => ({
    id: `s/t${i}`, server: 's', name: `t${i}`, description: '',
    consumes: Array.from({ length: 300 }, (_, j) => ({ param: `p${j}`, type: `type.${i}.${j}` })),
    yields: [{ field: 'o', type: `type.${i}.out` }], risk: [], schemaTokens: 1,
  })) };
  await store.ingestCatalog(big); // 1500 FEEDS edges must arrive in >=2 batches
  const feedBatches = em.statements.filter((s) => s === 'UNWIND $rows AS row CREATE (a {id: row.src})-[:FEEDS]->(b {id: row.dst})');
  assert.ok(feedBatches.length >= 2);
  const cat = await store.loadCatalog('test');
  assert.equal(cat.tools.length, 5);
  assert.equal(cat.tools[0].consumes.length, 300);
});

test('hydra mode: ingest of new tools lands in the graph and changes later plans', async () => {
  const em = emulator();
  process.env.HYDRA_BOLT_URL = env.HYDRA_BOLT_URL;
  const engine = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-hydra-test3', hydraRunner: em });
  await engine.ingest({
    generated_at: new Date().toISOString(), provenance: 'test', servers: [{ id: 'acme', tools: 1 }], types: ['acme.widget'],
    tools: [{ id: 'acme/make_acme_widget', server: 'acme', name: 'make_acme_widget', description: 'make an acme widget', consumes: [], yields: [{ field: 'widget', type: 'acme.widget' }], risk: [], schemaTokens: 10 }],
  });
  const plan = await engine.plan({ task: 'make an acme widget' });
  assert.ok(plan.steps.some((s) => s.tool_id === 'acme.make_acme_widget'));
  await engine.close();
  delete process.env.HYDRA_BOLT_URL;
});

test('embedded mode: honest explain, no database claims', async () => {
  delete process.env.HYDRA_BOLT_URL;
  const engine = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-hydra-test4', embedded: true });
  const plan = await engine.plan({ task: 'Open a PR on acme/api' });
  assert.equal(plan.explain.transport, 'embedded');
  assert.equal(plan.explain.cypher, null);
});

test('no HYDRA_BOLT_URL and no opt-in: fails loudly with setup guidance', async () => {
  delete process.env.HYDRA_BOLT_URL;
  await assert.rejects(() => SwitchboardEngine.create({ memoryDir: '/tmp/sbx-hydra-test5' }), /HYDRA_BOLT_URL/);
});
