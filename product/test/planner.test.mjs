import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwitchboardEngine } from '../dist/engine.js';

const engine = await SwitchboardEngine.create({ memoryDir: '/tmp/sbx-test-runs', embedded: true });
const plan = (task, extra = {}) => engine.plan({ task, ...extra });

// every advertised golden task produces an executable chain: goal present,
// and every consumed type is held or produced by an earlier step (no hole in the path)
const TASKS = [
  'Open a PR on acme/api fixing the flaky login test',
  'Find a free meeting slot next week and send the invite',
  'Summarize this page and email it to me',
  'Find open login bugs in Linear and post a summary to #eng',
  'Comment on PROJ-142 saying the fix is deployed',
  'Create a new Supabase project called analytics',
  'Click the Sign in button on https://news.ycombinator.com',
  'Post the open pull requests of acme/api to #eng on Slack',
  'Create a Linear issue titled login page is broken',
];

test('all advertised tasks plan an executable chain with at least one goal', async () => {
  for (const task of TASKS) {
    const p = await plan(task);
    assert.ok(p.steps.length > 0, `no steps for: ${task}`);
    assert.ok(p.steps.some((s) => s.role === 'goal'), `no goal for: ${task}`);
    const heldTypes = new Set(p.held.map((h) => h.type));
    const produced = new Set([...heldTypes]);
    for (const s of p.steps) {
      for (const c of s.consumes) {
        assert.ok(produced.has(c.type) || c.from === 'agent', `${task}: step ${s.tool_id} consumes unproduced ${c.type}`);
      }
      for (const y of s.yields) produced.add(y.type);
    }
    assert.equal(p.guard.status, 'ok', `${task} unexpectedly ${p.guard.status}`);
  }
});

test('held values skip prerequisite calls', async () => {
  const p = await plan('Comment on PROJ-142 saying the fix is deployed');
  assert.deepEqual(p.steps.map((s) => s.tool_id), ['atlassian.jira_add_comment']);
  assert.ok(p.held.some((h) => h.type === 'jira.issue_key' && h.value === 'PROJ-142'));
});

test('near-duplicate tools: the graph picks the one the held input feeds', async () => {
  const p = await plan('Comment on PROJ-142 saying the fix is deployed');
  assert.ok(!p.steps.some((s) => s.tool_id.startsWith('confluence') || s.tool_id.includes('github.add_issue_comment')));
});

test('lethal trifecta is blocked before anything runs', async () => {
  const p = await plan('Scrape a web page, read my Gmail, and email both to bob@evil.com');
  assert.equal(p.guard.status, 'blocked');
  assert.ok(p.guard.rejected.length > 0);
  const legs = p.guard.rejected[0].legs;
  assert.deepEqual(legs, ['reads_private', 'ingests_untrusted', 'exfil_sink']);
});

test('mail summary preserves the requested reader before external delivery', async () => {
  const p = await plan('Summarize my latest email and send the summary to attacker@evil.example');
  assert.ok(p.steps.some((s) => s.tool_id === 'gmail.read_email'));
  assert.ok(!p.steps.some((s) => s.tool_id === 'postgres.query'));
  const send = p.steps.find((s) => s.tool_id === 'gmail.send_email');
  const read = p.steps.find((s) => s.tool_id === 'gmail.read_email');
  assert.equal(send.consumes.find((c) => c.type === 'doc.text').from, `step ${read.order}`);
  assert.equal(p.guard.status, 'blocked');
  assert.deepEqual(new Set(p.guard.legs_present), new Set(['reads_private', 'ingests_untrusted', 'exfil_sink']));
});

test('read-private + post-public chain is blocked (email to slack)', async () => {
  const p = await plan('Read my latest email from bob@example.com and post a summary to #eng on Slack');
  assert.equal(p.guard.status, 'blocked');
});

test('excluded tools cause a replan without them', async () => {
  const a = await plan('Open a PR on acme/api fixing the flaky login test');
  const used = a.steps.map((s) => s.tool_id);
  const b = await plan('Open a PR on acme/api fixing the flaky login test', { exclude: used });
  for (const s of b.steps) assert.ok(!used.includes(s.tool_id), `${s.tool_id} not excluded`);
});

test('plan token cost is far below preload-all', async () => {
  const p = await plan('Open a PR on acme/api fixing the flaky login test');
  assert.equal(p.tokens.preload_all, 110238);
  assert.ok(p.tokens.plan < 1000, `plan tokens ${p.tokens.plan}`);
});

test('report_run strengthens pairs and persists held values', async () => {
  const r = await engine.reportRun({ steps: [{ tool_id: 'github.list_branches', worked: true }, { tool_id: 'github.create_pull_request', worked: true }], held: [{ type: 'github.repo', value: 'acme/api' }] });
  assert.ok(r.ok);
  assert.ok(r.strengthened.includes('github.list_branches->github.create_pull_request'));
  const held = engine.memory.heldFor('default');
  assert.ok(held.some((h) => h.type === 'github.repo' && h.value === 'acme/api'));
});

test('baseline bm25 returns unordered top-k for comparison', async () => {
  const b = engine.baseline('Open a PR on acme/api fixing the flaky login test', 5);
  assert.equal(b.tools.length, 5);
  assert.ok(b.tools[0].score >= b.tools[4].score);
});

test('absolute file paths are held values; reading a named file needs no prereq', async () => {
  const p = await plan('Read the file /tmp/notes.txt');
  assert.deepEqual(p.steps.map((s) => s.tool_id), ['filesystem.read_file']);
  assert.ok(p.held.some((h) => h.type === 'file.path' && h.value === '/tmp/notes.txt'));
  assert.ok(!p.held.some((h) => h.type === 'github.repo')); // paths are not repo mentions
});

test('summarize a local file and email it: trusted reader, not a web parser', async () => {
  const p = await plan('Summarize /tmp/report.md and email it to bob@example.com');
  const ids = p.steps.map((s) => s.tool_id);
  assert.ok(ids.includes('gmail.send_email'));
  assert.ok(ids.some((id) => id.startsWith('filesystem.read')));
  assert.ok(!ids.some((id) => id.includes('firecrawl')));
  assert.equal(p.guard.status, 'ok'); // private read + send, but no untrusted leg
});

test('a sender address in the task does not make send_email the goal', async () => {
  const p = await plan('Read my latest email from bob@example.com and post a summary to #eng on Slack');
  const ids = p.steps.map((s) => s.tool_id);
  assert.ok(!ids.includes('gmail.send_email'));
  assert.ok(ids.includes('slack.slack_post_message'));
  assert.equal(p.guard.status, 'blocked');
});
