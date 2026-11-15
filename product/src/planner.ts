import type { Held, Plan, PlanRequest, PlanStep, ToolNode, Yield } from './types.js';
import type { GraphView } from './graph.js';
import { Memory } from './memory.js';
import { dotted, slashed } from './catalog.js';
import { checkGuard } from './guard.js';

const STOP = new Set(('a,an,the,and,or,to,of,on,in,for,with,my,me,it,this,that,all,every,each,both,open,create,make,new,please,can,you,saying,says,called,next,week,free,latest,fix,fixing'.split(',')));

const SYNONYMS: Record<string, string[]> = {
  pr: ['pull', 'request'], 'pull request': [], mr: ['merge', 'request'],
  open: ['create'],
  bugs: ['issues', 'bug'], issue: ['ticket'], email: ['mail', 'gmail'], mail: ['email'],
  summarize: ['summary'], summary: ['summarize'], invite: ['event', 'calendar'], meeting: ['event', 'calendar'],
  scrape: ['crawl', 'fetch', 'page'], post: ['send', 'message'], comment: ['add', 'comment'],
  click: ['browser', 'click'], deploy: ['deployed', 'release'],
};

const CAPABILITY: [RegExp, string][] = [
  [/create_pull_request/, 'code.open_pr'],
  [/merge_pull_request/, 'code.merge_pr'],
  [/add_reply_to_pull_request_comment/, 'code.comment_pr'],
  [/list_pull_requests|search_pull_requests/, 'code.list_prs'],
  [/search_repositories/, 'code.find_repo'],
  [/search_code/, 'code.search'],
  [/push_files|create_or_update_file/, 'code.push'],
  [/create_gist/, 'code.gist'],
  [/list_issues|search_issues/, 'issue.list'],
  [/create_issue/, 'issue.create'],
  [/jira_add_comment|add_issue_comment|add_comment/, 'issue.comment'],
  [/confluence_add_comment/, 'docs.comment'],
  [/send_email/, 'email.send'],
  [/search_emails|read_email|get_email/, 'email.read'],
  [/post_message/, 'chat.post'],
  [/list_events|get_events/, 'calendar.read'],
  [/create.*event/, 'calendar.create'],
  [/firecrawl_scrape|^fetch.fetch$|fetch_fetch/, 'web.fetch'],
  [/brave_web_search|web_search/, 'web.search'],
  [/browser_click|browser_navigate/, 'browser.use'],
  [/create_project/, 'cloud.create_project'],
  [/create_branch/, 'code.branch'],
  [/get.freebusy|freebusy|availability/, 'calendar.availability'],
  [/create.events|create_event/, 'calendar.schedule'],
  [/list.calendars/, 'calendar.read'],
  [/confluence_get_page/, 'docs.read'],
  [/linear_get_user_issues|linear_search_issues/, 'issue.search'],
  [/browser_click/, 'browser.click'],
  [/linear_create_issue/, 'issue.create'],
];

const VERBS = new Set(('add,create,get,list,search,read,update,delete,remove,send,post,write,reply,merge,fork,push,pull,open,close,set,start,stop,run,execute,fetch,scrape,click,navigate,confirm,assign,request,download,upload,insert,upsert,archive,duplicate,move,copy,rename,join,leave,invite,cancel,schedule,edit,append,batch,retrieve,generate,summarize,transition,link,unlink,watch,unwatch,react,pin,unpin,star,follow,block,mute,review,resolve,approve,submit,check,verify,find,take,make,inline,new,to').split(','));

const singular = (t: string) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);

const HELD_PATTERNS: { type: string; re: RegExp; value: (m: RegExpMatchArray) => string }[] = [
  { type: 'file.path', re: /(^|[^\w.~-])((?:\/[\w.~-]+)+)/g, value: (m) => m[2] },
  { type: 'github.repo', re: /(?<![\w/.-])([\w][\w.-]*\/[\w][\w.-]*)\b/g, value: (m) => m[1] },
  { type: 'url', re: /\b(https?:\/\/[^\s)"']+)/g, value: (m) => m[1] },
  { type: 'email.address', re: /\b([\w.+-]+@[\w-]+\.[\w.]+)\b/g, value: (m) => m[1] },
  { type: 'jira.issue_key', re: /\b([A-Z][A-Z0-9]+-\d+)\b/g, value: (m) => m[1] },
  { type: 'slack.channel_id', re: /\b(C[0-9A-Z]{8,})\b/g, value: (m) => m[1] },
];

function tokensOf(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9#@./:_-]+/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));
}

export class Planner {
  /** makeGraph builds a fresh graph view per plan, honoring exclude lists. */
  constructor(private makeGraph: (exclude: string[]) => GraphView, private memory: Memory) {}

  taskTokens: Set<string> = new Set();

  extractHeld(task: string): Held[] {
    const held: Held[] = [
      { type: 'session', source: 'implicit' },
      { type: 'text.query', source: 'implicit' },
    ];
    const seen = new Set<string>();
    for (const { type, re, value } of HELD_PATTERNS) {
      for (const m of task.matchAll(re)) {
        const v = value(m as RegExpMatchArray);
        const key = `${type}:${v}`;
        if (seen.has(key)) continue;
        seen.add(key);
        held.push({ type, value: v, source: `mention:${v}` });
      }
    }
    return held;
  }

  /** Score every tool against the task; return goal tools in mention order. */
  async pickGoals(graph: GraphView, task: string, exclude: Set<string>): Promise<ToolNode[]> {
    const taskTokens = tokensOf(task);
    const expanded = new Set(taskTokens);
    for (const t of taskTokens) for (const syn of SYNONYMS[t] ?? []) expanded.add(syn);
    const lower = task.toLowerCase();

    interface Scored { tool: ToolNode; score: number; pos: number }
    const scored: Scored[] = [];
    for (const tool of await graph.allTools()) {
      if (exclude.has(tool.id) || exclude.has(dotted(tool.id))) continue;
      const nameTokens = tool.name.toLowerCase().split(/[_\s-]+/);
      const descTokens = tokensOf(tool.description);
      let score = 0;
      let pos = Number.MAX_SAFE_INTEGER;
      for (const nt of nameTokens) {
        if (expanded.has(nt)) {
          score += 2;
          const i = lower.indexOf(nt);
          if (i >= 0) pos = Math.min(pos, i);
        }
      }
      let descScore = 0;
      for (const dt of new Set(descTokens)) if (expanded.has(dt)) descScore += 0.15;
      score += Math.min(1.2, descScore);
      // strong phrase boosts
      if (/pull request|\bpr\b/.test(lower) && /pull_request/.test(tool.name)) score += 6;
      if (/\bpr\b|pull request/.test(lower) && /create/.test(lower) && /create_pull_request/.test(tool.name)) score += 6;
      if (/#\w+/.test(lower) && /post_message|send/.test(tool.name) && /slack|chat/.test(tool.server)) score += 4;
      if (/@/.test(lower) && /send_email/.test(tool.name) && /send|email (it|this|both|them)/.test(lower)) score += 4;
      if (/\bbugs?\b/.test(lower) && /search_issues|list_issues/.test(tool.name)) score += 3;
      if (/scrape/.test(lower) && /scrape/.test(tool.name)) score += 5;
      if (/click/.test(lower) && /browser_click/.test(tool.name)) score += 5;
      if (/comment/.test(lower) && /add_comment|add_issue_comment/.test(tool.name)) score += 5;
      if (/free|slot|availability/.test(lower) && /list_events|get_events|freebusy|availability/.test(tool.name)) score += 4;
      if (/invite|schedule|create.*(event|meeting)/.test(lower) && /create.*event/.test(tool.name)) score += 4;
      if (/create.*project/.test(lower) && /create_project/.test(tool.name)) score += 6;
      if (/open prs|pull requests of/.test(lower) && /list_pull_requests/.test(tool.name)) score += 5;
      if (/(open|create|make)\b.*\b(pr|pull request)\b/.test(lower) && /create_pull_request/.test(tool.name)) score += 8;
      if (/batch/.test(tool.name)) score -= 3;
      if (/latest email|read my (gmail|email|mail)/.test(lower) && /search_emails|list_messages|read_email/.test(tool.name)) score += 5;
      if (/free.*(slot|time)|availability/.test(lower) && /freebusy|availability/.test(tool.name)) score += 5;
      if (/send the invite|schedule/.test(lower) && /create.events|create_event/.test(tool.name)) score += 5;
      if (/create.*issue/.test(lower) && /create_issue/.test(tool.name)) score += 6;
      if (/summarize this page/.test(lower) && /confluence_get_page|fetch|scrape/.test(tool.name)) score += 3;
      if (/^\s*post|post the/.test(lower) && /list_/.test(tool.name)) score += 1;
      if (score > 0) scored.push({ tool, score, pos });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0]?.score ?? 0;
    const heldTypes = this.extractHeld(task).map((h) => h.type);
    const expandedSing = new Set([...expanded].map(singular));
    // Near-duplicate tools: group by the task object they act on ("pull request",
    // "comment", "issue"...). Three tools can score the same; only one takes the
    // input you hold - the winner is the one whose inputs the held values feed.
    const groupKey = (tool: ToolNode): string => {
      const bare = tool.name.toLowerCase().replace(/[_\s-]+/g, '_').replace(new RegExp(`^${tool.server}_`), '');
      return bare.split('_').map(singular).filter((t) => !VERBS.has(t) && expandedSing.has(t)).sort().join('.');
    };
    const byObject = new Map<string, Scored>();
    for (const s of scored) {
      const key = groupKey(s.tool);
      if (key === '' && s.score < top * 0.7) continue; // no object overlap: only exceptional matches
      if (key !== '' && s.score < Math.max(2.5, top * 0.4)) continue;
      const fit = (x: Scored) => {
        const c = x.tool.consumes;
        return c.filter((k) => heldTypes.includes(k.type)).length * 3 - c.length + x.score;
      };
      const prev = byObject.get(key);
      if (!prev || fit(s) > fit(prev)) byObject.set(key, s);
    }
    // "email/post it to <someone>" needs the way out as an explicit goal, or the
    // guard never sees the exfil edge the user asked for. Self-sends ("to me") excluded.
    const sendVerb = /send|email (it|this|both|them)|post|share|upload|notify/.test(lower);
    const externalRecipient = /@[\w.-]+\.[a-z]{2,}|#\w+|to (?!me\b)[a-z]/.test(lower);
    if (sendVerb && externalRecipient) {
      // a scrape/navigate flagged as a sink is not the send the user asked for
      const isSendTool = (s: Scored) => s.tool.risk.includes('exfil_sink') && /send|post|email|upload|share|message|comment/.test(s.tool.name);
      const hasSink = [...byObject.values()].some(isSendTool);
      if (!hasSink) {
        const sink = scored.find((s) => isSendTool(s) && groupKey(s.tool) !== '');
        if (sink) byObject.set(`sink:${groupKey(sink.tool)}`, sink);
      }
    }
    const goals = [...byObject.values()].slice(0, 3);
    // information producers before sinks, mention order within each group
    goals.sort((a, b) => {
      const sink = (x: Scored) => (x.tool.risk.includes('exfil_sink') ? 1 : 0);
      return sink(a) - sink(b) || a.pos - b.pos;
    });
    return goals.map((g) => g.tool);
  }

  /**
   * Run memory at the goal level: when the task's own goal tool keeps failing,
   * swap it for a working tool that produces an overlapping type and fits the
   * task words. This is the self-healing half of the learning loop.
   */
  private async substituteBrokenGoals(graph: GraphView, goals: ToolNode[], exclude: Set<string>, notes: string[]): Promise<ToolNode[]> {
    const out: ToolNode[] = [];
    for (const g of goals) {
      const hist = this.memory.historyOf(dotted(g.id));
      if (hist.fail >= 2 && hist.fail > hist.ok) {
        const all = await graph.allTools();
        const taskFit = (t: ToolNode) => {
          const toks = new Set([...t.name.toLowerCase().split(/[_\s-]+/), ...tokensOf(t.description)]);
          let n = 0;
          for (const tok of toks) if (this.taskTokens.has(tok)) n++;
          return n;
        };
        const subs = all
          .filter((t) => t.id !== g.id && !exclude.has(t.id) && g.yields.some((y) => t.yields.some((yy) => yy.type === y.type)))
          .sort((a, b) =>
            (Number(/create|send|gist|upload|share|post|publish/.test(a.name)) - Number(/create|send|gist|upload|share|post|publish/.test(b.name)))
            || (this.memory.historyOf(dotted(b.id)).ok - this.memory.historyOf(dotted(a.id)).ok)
            || (taskFit(b) - taskFit(a))
            || (a.schemaTokens - b.schemaTokens));
        const sub = subs[0];
        if (sub && this.memory.historyOf(dotted(sub.id)).fail === 0) {
          notes.push(`avoided ${dotted(g.id)} (${hist.fail} failed runs); substituted ${dotted(sub.id)}`);
          out.push(sub);
          continue;
        }
      }
      out.push(g);
    }
    return out;
  }

  private capabilityFor(tool: ToolNode): string {
    for (const [re, cap] of CAPABILITY) if (re.test(tool.id) || re.test(tool.name)) return cap;
    const verb = tool.name.split(/[_\s]/)[0];
    return `${tool.server}.${verb}`;
  }

  /**
   * Backward-chain: shortest sequence of tools producing `type` from `available`.
   * Returns tool sequence, or null when the type cannot be produced within depth.
   */
  private async satisfy(graph: GraphView, type: string, available: Set<string>, exclude: Set<string>, depth: number, visiting: Set<string>, explicitHeld: Set<string> = new Set(), consumerId?: string): Promise<ToolNode[] | null> {
    if (available.has(type)) return [];
    if (depth <= 0 || visiting.has(type)) return null;
    visiting.add(type);
    const producers = (await graph.producersOf(type)).filter((t) => !exclude.has(t.id));
    // an explicitly held value (a path, url, key the task names) points at the honest reader of it
    const fedByHeld = (t: ToolNode) => t.consumes.filter((c) => explicitHeld.has(c.type)).length;
    // among equal candidates prefer the producer the task actually talks about
    const taskFit = (t: ToolNode) => {
      const toks = new Set([...t.name.toLowerCase().split(/[_\s-]+/), ...tokensOf(t.description)]);
      let n = 0;
      for (const tok of toks) if (this.taskTokens.has(tok)) n++;
      return n;
    };
    // A "create/send/gist" tool *manufactures* a fresh value - wrong way to obtain an
    // input the task already implies. Search/navigate/read producers are honest sources.
    const fabricates = (t: ToolNode) => /create|send|gist|upload|share|post|publish/.test(t.name);
    const ranked = producers
      .map((t) => ({ t, need: t.consumes.filter((c) => !available.has(c.type)).length }))
      .sort((a, b) => a.need - b.need
        || (Number(fabricates(a.t)) - Number(fabricates(b.t)))
        // run memory: prefer the producer that historically led into this consumer;
        // a historically FAILING pair (weight > 1) loses to an untried alternative
        || (consumerId ? this.memory.pairWeight(dotted(a.t.id), dotted(consumerId)) - this.memory.pairWeight(dotted(b.t.id), dotted(consumerId)) : 0)
        || (fedByHeld(b.t) - fedByHeld(a.t))
        // a trusted reader beats an untrusted-content leg for the same input
        || (Number(a.t.risk.includes('ingests_untrusted')) - Number(b.t.risk.includes('ingests_untrusted')))
        || (taskFit(b.t) - taskFit(a.t))
        || (Number(/deprecated/i.test(b.t.description)) - Number(/deprecated/i.test(a.t.description)))
        || a.t.schemaTokens - b.t.schemaTokens);
    for (const { t } of ranked) {
      const seq: ToolNode[] = [];
      const avail = new Set(available);
      let ok = true;
      for (const c of t.consumes) {
        const sub = await this.satisfy(graph, c.type, avail, new Set([...exclude, ...seq.map((s) => s.id)]), depth - 1, new Set(visiting), explicitHeld, t.id);
        if (sub === null) { ok = false; break; }
        for (const s of sub) { seq.push(s); for (const y of s.yields) avail.add(y.type); }
      }
      if (ok) { visiting.delete(type); return [...seq, t]; }
    }
    visiting.delete(type);
    return null;
  }

  async plan(req: PlanRequest): Promise<Plan> {
    const started = Date.now();
    const exclude = new Set((req.exclude ?? []).map(slashed));
    const graph = this.makeGraph([...exclude]);
    const held: Held[] = [...this.extractHeld(req.task), ...(req.held ?? []).map((h) => ({ ...h, source: h.value ? `given:${h.value}` : 'given' }))];
    if (req.account) held.push(...this.memory.heldFor(req.account).filter((h) => !held.some((x) => x.type === h.type)));

    const heldTypes = new Set(held.map((h) => h.type));
    const explicitHeld = new Set(held.filter((h) => h.value).map((h) => h.type));
    let goals = await this.pickGoals(graph, req.task, exclude);
    const notes: string[] = [];
    goals = await this.substituteBrokenGoals(graph, goals, exclude, notes);
    this.taskTokens = new Set(tokensOf(req.task));
    for (const t of [...this.taskTokens]) for (const syn of SYNONYMS[t] ?? []) this.taskTokens.add(syn);
    const steps: ToolNode[] = [];
    const available = new Set(heldTypes);
    const usedGoals: ToolNode[] = [];

    for (const goal of goals) {
      if (usedGoals.some((g) => g.id === goal.id)) continue;
      const excludeNow = new Set([...exclude, ...steps.map((s) => s.id)]);
      let seq: ToolNode[] = [];
      for (const c of goal.consumes) {
        if (available.has(c.type)) continue;
        const sub = await this.satisfy(graph, c.type, available, new Set([...excludeNow, goal.id]), 4, new Set(), explicitHeld, goal.id);
        if (sub === null) continue; // leave unsatisfiable inputs to the agent's own values
        for (const s of sub) {
          if (!seq.some((x) => x.id === s.id) && s.id !== goal.id) {
            seq.push(s);
            for (const y of s.yields) available.add(y.type);
          }
        }
      }
      steps.push(...seq, goal);
      for (const y of goal.yields) available.add(y.type);
      usedGoals.push(goal);
    }

    // order + annotate
    const producedBy = new Map<string, number>();
    const planSteps: PlanStep[] = steps.map((t, i) => ({
      order: i + 1,
      tool_id: dotted(t.id),
      server_id: t.server,
      role: usedGoals.includes(t) ? 'goal' : 'prerequisite',
      consumes: t.consumes.map((c) => ({ param: c.param, type: c.type, from: heldTypes.has(c.type) ? 'held' : producedBy.has(c.type) ? `step ${producedBy.get(c.type)}` : 'agent' })),
      yields: t.yields,
      risk: t.risk.length ? t.risk : undefined,
      schema: t.schema,
      schema_tokens: t.schemaTokens,
    }));
    steps.forEach((t, i) => { for (const y of t.yields) if (!producedBy.has(y.type)) producedBy.set(y.type, i + 1); });
    // fix pass: producedBy was filled after mapping; recompute consumes' from
    for (const s of planSteps) {
      const t = steps[s.order - 1];
      s.consumes = t.consumes.map((c) => ({ param: c.param, type: c.type, from: heldTypes.has(c.type) ? 'held' : producedBy.has(c.type) && producedBy.get(c.type)! < s.order ? `step ${producedBy.get(c.type)}` : 'agent' }));
    }

    const planTokens = planSteps.reduce((a, s) => a + s.schema_tokens, 0);
    const preload = await graph.preloadTokens();
    const guard = checkGuard(planSteps, steps, req.allow_destructive ?? false);
    const plan: Plan = {
      plan_id: `pl_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      task: req.task,
      capabilities: [...new Set(usedGoals.map((g) => this.capabilityFor(g)))],
      held,
      steps: planSteps,
      tokens: { plan: planTokens, preload_all: preload, saved: preload - planTokens },
      guard,
      notes: notes.length ? notes : undefined,
      explain: {
        cypher: null, // embedded mode runs no database query; hydra mode overwrites this with the executed statement
        ms: Date.now() - started,
        transport: 'embedded',
      },
    };
    return plan;
  }
}
