// Reproduces the advertised comparison: preload-all vs BM25 top-k vs Switchboard,
// over the bundled 420-tool starter catalog. Numbers are measured, not copied.
import { SwitchboardEngine } from '../dist/engine.js';

const engine = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-bench', embedded: true });
const tasks = [
  { task: 'Open a PR on acme/api fixing the flaky login test', want: ['github.create_pull_request'] },
  { task: 'Find a free meeting slot next week and send the invite', want: ['google-calendar.create-events'] },
  { task: 'Summarize this page and email it to me', want: ['atlassian.confluence_get_page'] },
  { task: 'Find open login bugs in Linear and post a summary to #eng', want: ['slack.slack_post_message'] },
  { task: 'Comment on PROJ-142 saying the fix is deployed', want: ['atlassian.jira_add_comment'] },
  { task: 'Create a new Supabase project called analytics', want: ['supabase.create_project'] },
  { task: 'Post the open pull requests of acme/api to #eng on Slack', want: ['github.list_pull_requests', 'slack.slack_post_message'] },
];

const stats = await engine.stats();
console.log(`catalog: ${stats.tools} tools, ${stats.servers} servers, preload-all = ${stats.preload_all_tokens} tokens\n`);
console.log('| task | switchboard tokens | chain recall | ordered | bm25-5 has goal | bm25-5 tokens |');
console.log('|---|---|---|---|---|---|');
const { countTokens } = await import('../dist/catalog.js');
let totPlan = 0, totRecall = 0, totOrder = 0;
for (const { task, want } of tasks) {
  const p = await engine.plan({ task });
  const ids = p.steps.map((s) => s.tool_id);
  const recall = want.filter((w) => ids.includes(w)).length / want.length;
  const lastPos = new Map(ids.map((id, i) => [id, i]));
  const ordered = want.every((w, i) => i === 0 || (lastPos.get(want[i - 1]) ?? -1) < (lastPos.get(w) ?? -1));
  const b5 = engine.baseline(task, 5);
  const bHas = want.every((w) => b5.tools.some((t) => t.tool_id === w));
  const bTokens = b5.tools.reduce((a, t) => a + (engine.catalog.tools.find((x) => x.id === t.tool_id.replace('.', '/'))?.schemaTokens ?? 0), 0);
  totPlan += p.tokens.plan; totRecall += recall; totOrder += ordered ? 1 : 0;
  console.log(`| ${task.slice(0, 42)}… | ${p.tokens.plan} | ${(recall * 100).toFixed(0)}% | ${ordered} | ${bHas} | ${bTokens} |`);
}
console.log(`\nmeans: plan ${(totPlan / tasks.length).toFixed(0)} tokens (${((1 - totPlan / tasks.length / stats.preload_all_tokens) * 100).toFixed(1)}% below preload-all), chain recall ${(totRecall / tasks.length * 100).toFixed(0)}%, ordered ${totOrder}/${tasks.length}`);
