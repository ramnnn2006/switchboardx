// Learning-curve experiment: does run memory in the graph actually improve plans?
//
// Setup: the 7 bench fixture tasks are planned repeatedly. Execution is SIMULATED
// with a declared ground truth: the tools in BROKEN always fail (and any plan
// containing them fails); everything else works. After each iteration the engine
// reports run outcomes (report_run), which writes pair weights to memory - in
// HydraDB mode those writes are graph records; here we run embedded for speed.
// Honest label: this measures the learning mechanism under simulated feedback,
// not real user sessions.
//
// Curves printed per iteration:
//   learning  - mean plan success with report_run feedback (the product)
//   no-memory - same planner, fresh memory every iteration, never learns (baseline)
//   bm25      - top-5 retrieval without chaining: fraction whose top-5 contains the goal tool (no-graph baseline)
import { SwitchboardEngine } from '../dist/engine.js';
import { bm25TopK } from '../dist/baseline.js';
import { loadCatalog } from '../dist/catalog.js';
import { rmSync } from 'node:fs';

// declared ground truth for the simulation: these tools always fail
const BROKEN = new Set(['postgres/query', 'firecrawl/firecrawl_scrape']);

const TASKS = [
  { task: 'Open a PR on acme/api fixing the flaky login test', goal: 'github.create_pull_request' },
  { task: 'Summarize my latest email and send the summary to sam@acme.com', goal: 'gmail.send_email' },
  { task: 'Scrape https://acme.com/status and post it to #status', goal: 'slack.slack_post_message' },
  { task: 'Find open login bugs in Linear and post a summary to #bugs', goal: 'linear.linear_search_issues' },
  { task: 'Comment on PROJ-142 saying the fix is deployed', goal: 'atlassian.jira_add_comment' },
  { task: 'Create a new Supabase project called analytics', goal: 'supabase.create_project' },
  { task: 'Post the open pull requests of acme/api to #eng', goal: 'github.list_pull_requests' },
];

const works = (toolId) => !BROKEN.has(toolId.replace('.', '/'));

const HYDRA = !!process.env.HYDRA_BOLT_URL || !!process.env.HYDRA_HTTP_URL;

async function curve(withLearning, hydraDir) {
  const dir = hydraDir ?? `/tmp/sbx-learning-${withLearning ? 'on' : 'off'}`;
  rmSync(dir, { recursive: true, force: true });
  const engine = await SwitchboardEngine.create({ memoryDir: dir, embedded: !HYDRA });
  if (HYDRA) await engine.clearMemory();
  const points = [];
  for (let iter = 0; iter < 10; iter++) {
    let ok = 0;
    for (const { task } of TASKS) {
      const plan = await engine.plan({ task });
      const steps = plan.steps.map((s) => ({ tool_id: s.tool_id, worked: works(s.tool_id) }));
      if (steps.every((s) => s.worked)) ok++;
      if (withLearning) await engine.reportRun({ task, plan_id: plan.plan_id, steps });
    }
    points.push(ok / TASKS.length);
  }
  await engine.close();
  return points;
}

const catalog = loadCatalog();
function bm25() {
  let hit = 0;
  for (const { task, goal } of TASKS) {
    const top = bm25TopK(catalog, task, 5).map((t) => t.id ?? t.tool_id);
    if (top.includes(goal) || top.includes(goal.replace('.', '/'))) hit++;
  }
  return hit / TASKS.length;
}

// no-memory first: it writes nothing, so it cannot contaminate the learning curve
const noMemory = await curve(false, HYDRA ? '/tmp/sbx-learning-shared' : undefined);
const learning = await curve(true, HYDRA ? '/tmp/sbx-learning-shared' : undefined);
const fmt = (xs) => xs.map((x) => (x * 100).toFixed(0).padStart(4)).join(' ');
console.log('simulated-feedback learning experiment (BROKEN =', [...BROKEN].join(', '), ')');
console.log('iterations:  ', [...Array(10).keys()].map((i) => String(i + 1).padStart(4)).join(' '));
console.log('learning %:  ', fmt(learning));
console.log('no-memory %: ', fmt(noMemory));
console.log(`bm25 top-5 goal-hit (no graph, static): ${(bm25() * 100).toFixed(0)}%`);
console.log(JSON.stringify({ broken: [...BROKEN], learning, no_memory: noMemory, bm25_top5_goal_hit: bm25() }));
