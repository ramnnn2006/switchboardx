import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { SwitchboardEngine } from './engine.js';
import type { PlanRequest, RunReport } from './types.js';

async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function startServer(engine: SwitchboardEngine, port = Number(process.env.SB_PORT ?? 8787)) {
  const send = (res: ServerResponse, code: number, data: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify(data));
  };
  const srv = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET' }); return res.end(); }
      if (url.pathname === '/api/health') return send(res, 200, { ok: true, ...(await engine.stats()) });
      if (url.pathname === '/api/plan' && req.method === 'POST') return send(res, 200, await engine.plan((await body(req)) as PlanRequest));
      if (url.pathname === '/api/plan_baseline' && req.method === 'POST') {
        const b = (await body(req)) as { task: string; k?: number };
        return send(res, 200, engine.baseline(b.task, b.k ?? 5));
      }
      if (url.pathname === '/api/report_run' && req.method === 'POST') return send(res, 200, await engine.reportRun((await body(req)) as RunReport));
      if (url.pathname === '/api/graph/galaxy') return send(res, 200, engine.galaxy());
      if (url.pathname === '/api/guard/check' && req.method === 'POST') {
        const plan = await engine.plan((await body(req)) as PlanRequest);
        return send(res, 200, plan.guard);
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
    }
  });
  srv.listen(port, () => console.error(`switchhboard-mcp api on :${port}`));
  return srv;
}
