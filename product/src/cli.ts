#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SwitchboardEngine } from './engine.js';
import { startServer } from './server.js';
import { startMcp } from './mcp.js';
import { inferConsumes, inferYields, inferRisk } from './typing.js';
import { schemaTokens } from './catalog.js';
import type { Catalog, ToolNode } from './types.js';

const args = process.argv.slice(2);
const cmd = args[0];

const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

async function ingest() {
  // switchboardx ingest --server "npx -y @modelcontextprotocol/server-filesystem /tmp" --name filesystem [--catalog out.json]
  const serverCmd = flag('server');
  const name = flag('name');
  if (!serverCmd || !name) {
    console.error('usage: switchhboard-mcp ingest --server "<command...>" --name <server-id> [--catalog out.json]');
    process.exit(1);
  }
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport, getDefaultEnvironment } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const [command, ...rest] = serverCmd.split(/\s+/);
  const transport = new StdioClientTransport({ command, args: rest, env: getDefaultEnvironment(), stderr: 'pipe' });
  const client = new Client({ name: 'switchboardx-ingest', version: '0.1.0' });
  await client.connect(transport);
  const listed = await client.listTools();
  const tools: ToolNode[] = listed.tools.map((t) => {
    const schema = { name: t.name, description: t.description ?? '', inputSchema: t.inputSchema as Record<string, unknown> };
    return {
      id: `${name}/${t.name}`,
      server: name,
      name: t.name,
      description: t.description ?? '',
      consumes: inferConsumes(name, schema),
      yields: inferYields(name, schema),
      risk: inferRisk(schema),
      schemaTokens: schemaTokens(schema),
      schema,
    };
  });
  await client.close();
  const out = flag('catalog') ?? `${name}.catalog.json`;
  let cat: Catalog = { generated_at: new Date().toISOString(), provenance: `ingested from live tools/list of ${serverCmd}`, servers: [{ id: name, tools: tools.length }], types: [], tools };
  if (existsSync(out)) {
    const prev = JSON.parse(readFileSync(out, 'utf8')) as Catalog;
    const map = new Map(prev.tools.map((t) => [t.id, t]));
    for (const t of tools) map.set(t.id, t);
    const sm = new Map(prev.servers.map((s) => [s.id, s]));
    sm.set(name, { id: name, tools: tools.length });
    cat = { ...prev, servers: [...sm.values()], tools: [...map.values()] };
  }
  cat.types = [...new Set(cat.tools.flatMap((t) => [...t.consumes.map((c) => c.type), ...t.yields.map((y) => y.type)]))].sort();
  writeFileSync(out, JSON.stringify(cat));
  console.log(`ingested ${tools.length} tools from "${serverCmd}" into ${out} (${cat.tools.length} total)`);
}

async function main() {
  const catalogPath = flag('catalog') ?? process.env.SB_CATALOG;
  const apiUrl = process.env.SB_API_URL;
  const embedded = has('embedded');

  if (cmd === 'ingest') return ingest();

  if (cmd === 'serve') {
    const engine = await SwitchboardEngine.create({ catalogPath, embedded });
    startServer(engine, Number(flag('port') ?? process.env.SB_PORT ?? process.env.PORT ?? 8787));
    return;
  }
  if (cmd === 'plan') {
    const task = flag('task') ?? args.slice(1).filter((a) => !a.startsWith('--')).join(' ');
    if (!task) { console.error('usage: switchhboard-mcp plan --task "..."'); process.exit(1); }
    const engine = await SwitchboardEngine.create({ catalogPath, embedded });
    console.log(JSON.stringify(await engine.plan({ task }), null, 1));
    await engine.close();
    return;
  }
  if (cmd === 'galaxy') {
    const engine = await SwitchboardEngine.create({ catalogPath, embedded });
    console.log(JSON.stringify(engine.galaxy()));
    await engine.close();
    return;
  }
  if (cmd === 'stats') {
    const engine = await SwitchboardEngine.create({ catalogPath, embedded });
    console.log(JSON.stringify(await engine.stats(), null, 1));
    await engine.close();
    return;
  }
  if (cmd === undefined || cmd === 'mcp') {
    // no-arg: stdio MCP server, the `npx -y switchhboard-mcp` integration path
    const engine = apiUrl ? null : await SwitchboardEngine.create({ catalogPath, embedded });
    await startMcp(engine, apiUrl);
    return;
  }
  console.error(`unknown command: ${cmd}\ncommands: (none)|mcp, serve, ingest, plan, galaxy, stats [--embedded]`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
