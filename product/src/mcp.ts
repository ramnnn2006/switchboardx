import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { SwitchboardEngine } from './engine.js';
import type { PlanRequest, RunReport } from './types.js';

const planShape = {
  task: z.string().describe('The task in plain words, e.g. "Open a PR on acme/api fixing the flaky login test"'),
  held: z.array(z.object({ type: z.string(), value: z.string().optional() })).optional()
    .describe('Typed values you already hold, e.g. {type:"github.repo", value:"acme/api"}. Held values skip prerequisite calls.'),
  exclude: z.array(z.string()).optional().describe('Tool ids to exclude; the plan is recomputed without them'),
  allow_destructive: z.boolean().optional().describe('Permit tools flagged destructive'),
};

async function post(url: string, data: unknown): Promise<unknown> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export async function startMcp(engine: SwitchboardEngine | null, apiUrl?: string) {
  const server = new McpServer({ name: 'switchhboard-mcp', version: '0.1.0' });
  const runPlan = async (req: PlanRequest) =>
    apiUrl ? post(`${apiUrl}/api/plan`, req) : engine!.plan(req);  // engine.plan is async in both modes

  server.registerTool('plan', {
    title: 'Plan a task against the tool graph',
    description: 'Give a task, get back only the tools it calls, in call order, with their schemas. Held values skip prerequisite calls. Guard rejects private-data + untrusted-input + send-out chains.',
    inputSchema: planShape,
  }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await runPlan(args), null, 1) }] }));

  server.registerTool('report_run', {
    title: 'Report what ran',
    description: 'Log which planned steps worked. Each report strengthens the NEXT edges between the tools you called, biasing future plans toward pairs that worked.',
    inputSchema: {
      task: z.string().optional(),
      plan_id: z.string().optional(),
      steps: z.array(z.object({ tool_id: z.string(), worked: z.boolean() })),
      held: z.array(z.object({ type: z.string(), value: z.string() })).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(apiUrl ? await post(`${apiUrl}/api/report_run`, args) : await engine!.reportRun(args as RunReport)) }],
  }));

  server.registerTool('catalog_stats', {
    title: 'Graph stats',
    description: 'Tool, type and server counts plus the full-context token cost this graph replaces.',
    inputSchema: {},
  }, async () => {
    const stats = apiUrl ? await (await fetch(`${apiUrl}/api/health`)).json() : await engine!.stats();
    return { content: [{ type: 'text', text: JSON.stringify(stats) }] };
  });

  await server.connect(new StdioServerTransport());
}
