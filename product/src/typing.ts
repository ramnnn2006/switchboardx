import type { Consume, RiskFlag, ToolSchema, Yield } from './types.js';

/**
 * Type and risk inference for freshly ingested MCP servers.
 * Heuristics: a wrong flag gives a wrong guard verdict - say so in docs.
 */

const PARAM_TYPES: [RegExp, string][] = [
  [/^owner$|^org(anization)?$/, 'org'],
  [/^repo(sitory)?$/, 'repo'],
  [/^branch$|^ref$/, 'branch'],
  [/^(file_?)?path$|^filename$/, 'file.path'],
  [/^channel(_?id)?$/, 'channel_id'],
  [/^user(_?id)?$|^username$/, 'user_id'],
  [/^message(_?id)?$|^ts$|^message_ts$/, 'message_ts'],
  [/^thread(_?id)?$/, 'thread_id'],
  [/^issue(_?key)?$/, 'issue_key'],
  [/^(project|project_?id)$/, 'project_id'],
  [/^page(_?id)?$/, 'page_id'],
  [/^database(_?id)?$/, 'database_id'],
  [/^q(uery)?$|^search$/, 'text.query'],
  [/^url$|^uri$|^link$/, 'url'],
  [/^(to|email|email_?address|recipient)$/, 'email.address'],
  [/^(body|content|text|message|summary|comment|title)$/, 'doc.text'],
  [/(_?id)$/, 'id'],
];

const CONTENT_PARAMS = /^(body|content|text|message|summary|comment)$/;

export function inferConsumes(server: string, schema: ToolSchema): Consume[] {
  const props = (schema.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
  const out = new Map<string, Consume>();
  const hasRepo = Object.keys(props).some((k) => /^(repo|repository)$/.test(k.toLowerCase()));
  for (const param of Object.keys(props)) {
    const p = param.toLowerCase();
    // git head/base refs only in a repo context (filesystem read_text_file uses head for line counts)
    if ((p === 'head' || p === 'base') && hasRepo) { out.set(`${server}.branch`, { param, type: `${server}.branch` }); continue; }
    for (const [re, suffix] of PARAM_TYPES) {
      if (re.test(p)) {
        // generic suffixes are namespaced to the server; universal ones stay global
        const universal = ['file.path', 'text.query', 'url', 'email.address', 'doc.text'];
        const type = universal.includes(suffix) ? suffix : suffix === 'repo' && p === 'owner' ? `${server}.repo` : `${server}.${suffix}`;
        if (!CONTENT_PARAMS.test(p) || suffix === 'doc.text') out.set(type, { param, type });
        break;
      }
    }
  }
  // owner+repo collapse into one repo handle
  if ([...out.values()].some((c) => c.param === 'owner') && [...out.values()].some((c) => /^(repo|repository)$/.test(c.param))) {
    for (const k of [...out.keys()]) if (out.get(k)!.param === 'owner') out.delete(k);
    for (const c of out.values()) if (/^(repo|repository)$/.test(c.param)) c.param = 'owner+repo';
  }
  return [...out.values()];
}

const YIELD_RULES: [RegExp, (m: RegExpMatchArray, server: string) => string[]][] = [
  [/^(list|search|get)_(\w*?)branches$/, (_m, s) => [`${s}.branch`]],
  [/^(list|search|get)_(\w*?)repositor/, (_m, s) => [`${s}.repo`]],
  [/^(list|search)_(\w*?)channels$/, (_m, s) => [`${s}.channel_id`]],
  [/^(list|search|get)_(\w*?)issues$/, (_m, s) => [`${s}.issue_key`]],
  [/^(list|search)_(\w*?)pull_requests$/, (_m, s) => [`${s}.pr_number`, 'url']],
  [/^(list|search)_(\w*?)organizations$/, (_m, s) => [`${s}.org_id`]],
  [/^(get|read|fetch)_(\w*?)profile$/, (_m, s) => [`${s}.user_id`]],
  [/^get_me$/, (_m, s) => [`${s}.user_id`]],
  [/^(search|read|get)_(\w*?)(emails?|messages?)$/, (_m, s) => [`${s}.message_id`, 'doc.text']],
  [/^(list|get)_(\w*?)messages$|^get_channel_history$/, (_m, s) => [`${s}.message_ts`, 'doc.text']],
  [/^(read|get)_(\w*?)(file|page|doc)/, (_m, s) => ['doc.text']],
  [/^(create)_(\w*?)branch/, (_m, s) => [`${s}.branch`]],
  [/^(create)_pull_request/, (_m, s) => [`${s}.pr_number`, 'url']],
  [/^(create|add)_(\w*?)(issue|ticket)/, (_m, s) => [`${s}.issue_key`]],
  [/^(create)_(\w*?)project/, (_m, s) => [`${s}.project_id`]],
  [/^(send|post)_/, () => ['message_ts']],
];

export function inferYields(server: string, schema: ToolSchema): Yield[] {
  for (const [re, fn] of YIELD_RULES) {
    const m = schema.name.match(re);
    if (m) return [...new Set(fn(m, server))].map((type) => ({ field: '$', type }));
  }
  return [];
}

const PRIVATE_RE = /(email|inbox|message|dm\b|file|document|drive|profile|contact|database|rows?|secret|credential|private|account)/i;
const READ_RE = /^(read|get|list|search|retrieve|fetch_history|show|view)|history|search/i;
const UNTRUSTED_RE = /(web|url|scrape|crawl|browse|fetch|search the web|internet|page)/i;
// sink = the tool's own verb sends content out: match the name, or a description that starts with the verb.
// (matching the whole description flags "provides detailed error messages" as email-sending)
const NAME_SINK_RE = /(send|post|publish|upload|share|tweet|notify|webhook|email|comment)/i;
const CREATE_SINK_RE = /create.*(issue|page|doc|comment|post|message)/i;
const DESC_SINK_RE = /^(send|post|publish|upload|share|tweet|notify|email)\b/i;
const DESTRUCTIVE_RE = /(delete|remove|drop|destroy|overwrite|execute_sql|run_sql|merge|close_|force|reset|kill|terminate|truncate)/i;

export function inferRisk(schema: ToolSchema): RiskFlag[] {
  const hay = `${schema.name} ${schema.description ?? ''}`;
  const flags = new Set<RiskFlag>();
  if (READ_RE.test(schema.name) && PRIVATE_RE.test(hay)) flags.add('reads_private');
  if (UNTRUSTED_RE.test(hay) && READ_RE.test(schema.name.replace(/^fetch$/, 'get'))) flags.add('ingests_untrusted');
  if (NAME_SINK_RE.test(schema.name) || CREATE_SINK_RE.test(schema.name) || DESC_SINK_RE.test((schema.description ?? '').trim())) flags.add('exfil_sink');
  if (DESTRUCTIVE_RE.test(hay)) flags.add('destructive');
  return [...flags];
}
