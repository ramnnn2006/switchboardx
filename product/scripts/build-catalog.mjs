// Builds data/catalog.starter.json from the published graph + schema data
// captured from https://switchhboard.vercel.app (see PROVENANCE note in README).
// The starter catalog lets a fresh install plan against a real 420-tool graph;
// users then run `switchboardx ingest` to build the graph from THEIR servers.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const siteData = process.argv[2] ?? join(here, '../../switchboard-site/switchhboard-rebuild/data');
const galaxy = JSON.parse(readFileSync(join(siteData, 'galaxy.json'), 'utf8'));
const schemas = JSON.parse(readFileSync(join(siteData, 'catalog.json'), 'utf8'));

const suffix = (t) => t.split('.').slice(1).join('.') || t;
const tools = [];
for (const n of galaxy.nodes) {
  if (n.kind !== 'tool') continue;
  const id = n.id.slice(2); // strip "t:"
  const full = schemas[id];
  const schema = full ? { name: full.name, description: full.description, inputSchema: full.inputSchema } : undefined;
  const props = schema?.inputSchema?.properties ?? {};
  const consumes = (n.consumes ?? []).map((type) => {
    // map a type onto the schema param that carries it
    const suf = suffix(type);
    let param = Object.keys(props).find((p) => p === suf || p === suf.replace(/_/g, '') || type.startsWith(`${props[p]?.['x-mcp-header'] ?? ''}`));
    if (!param) param = Object.keys(props).find((p) => suf.includes(p) || p.includes(suf));
    return { param: param ?? suf, type };
  });
  // the site graph types gmail/send_email as consuming a message_id + thread_id
  // (reply semantics). A fresh send needs the recipient and the body; carrying the
  // thread types makes every send drag in a search_emails prereq. Override.
  const finalConsumes = id === 'gmail/send_email'
    ? [{ param: 'to', type: 'email.address' }, { param: 'body', type: 'doc.text' }]
    : consumes;
  tools.push({
    id,
    server: n.server,
    name: n.label,
    description: n.desc ?? '',
    consumes: finalConsumes,
    yields: (n.yields ?? []).map((type) => ({ field: '$', type })),
    risk: n.risk ?? [],
    schemaTokens: n.schemaTokens ?? 0,
    schema,
  });
}
const out = {
  generated_at: new Date().toISOString(),
  provenance: 'Tool list, types, edges, risk flags and schema token counts derived from the public graph published at switchhboard.vercel.app (same project). 51 tools carry full input schemas from the same deployment; the rest carry name and description only. Spot-verified against live tools/list output: for @modelcontextprotocol/server-filesystem every published tool name matched a real tool and both full schemas matched exactly. Third-party tool names, descriptions and schemas remain the property of their respective MCP server authors.',
  servers: galaxy.servers,
  types: galaxy.nodes.filter((n) => n.kind === 'type').map((n) => n.label),
  tools,
};
mkdirSync(join(here, '../data'), { recursive: true });
writeFileSync(join(here, '../data/catalog.starter.json'), JSON.stringify(out));
console.log(`catalog.starter.json: ${tools.length} tools, ${out.types.length} types, ${out.servers.length} servers, ${tools.filter(t=>t.schema).length} full schemas, preload tokens = ${tools.reduce((a,t)=>a+t.schemaTokens,0)}`);
