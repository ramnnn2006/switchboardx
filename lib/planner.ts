import galaxy from "../data/galaxy.json";
import recorded from "../data/recorded-plans.json";
import catalog from "../data/catalog.json";
export type Tool = {
  id: string;
  label: string;
  server?: string;
  kind: string;
  consumes?: string[];
  yields?: string[];
  risk?: string[];
  schemaTokens?: number;
  desc?: string;
  x: number;
  y: number;
  degree: number;
};
export type ToolSchema = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};
export type Baseline = {
  task: string;
  k: number;
  method: string;
  tools: { tool_id: string; server_id: string; score: number | null }[];
  missing: { tool_id: string; reason: string }[];
  extra: string[];
  tokens: number;
  order: null;
  note?: string;
};
export const tools = galaxy.nodes.filter((n) => n.kind === "tool") as Tool[];
export const serverCounts = galaxy.servers;
export type Step = Tool & { order: number; schema?: ToolSchema };
export function guard(steps: Tool[]) {
  const flags = new Set(steps.flatMap((t) => t.risk || []));
  return flags.has("reads_private") &&
    flags.has("ingests_untrusted") &&
    flags.has("exfil_sink")
    ? "blocked"
    : "ok";
}
/** A deterministic, fully local planner over the preserved public catalog.
 * This is not the unavailable HydraDB service. Unknown tasks are explicitly unsupported. */
export function plan(
  task: string,
  held: string[] = [],
  excluded: string[] = [],
) {
  const recordings = recorded.plans as Record<
    string,
    {
      plan: {
        steps: {
          tool_id: string;
          schema_tokens: number;
          consumes: { type: string }[];
          yields: { type: string }[];
          risk?: string[];
          schema?: ToolSchema;
        }[];
        capabilities: string[];
        tokens: { plan: number; preload_all?: number; saved?: number };
        guard: { status: string };
      };
      baseline?: Baseline;
    }
  >;
  const exact =
    recordings[
      Object.keys(recordings).find(
        (t) => t.trim().toLowerCase() === task.trim().toLowerCase(),
      ) || ""
    ];
  if (exact) {
    // Replay the recorded plan. Held or excluded values adjust it: excluded
    // tools leave the chain, and the token receipt is the sum of the real
    // recorded per-step schema tokens, never a recomputed guess.
    const p = exact.plan;
    const idOf = (toolId: string) =>
      toolId.replace(/^([a-z0-9-]+)\./, "$1/");
    const missing = p.steps.map((s) => idOf(s.tool_id)).filter((id) => excluded.includes(id));
    const steps = p.steps
      .filter((s) => !excluded.includes(idOf(s.tool_id)) && !(s.yields?.length && s.yields.every(y=>held.includes(y.type))))
      .map((s, i) => {
        const id = idOf(s.tool_id);
        return {
          ...tools.find((t) => t.id === "t:" + id),
          id: "t:" + id,
          label: id.split("/")[1],
          server: id.split("/")[0],
          order: i + 1,
          schemaTokens: s.schema_tokens,
          consumes: s.consumes?.map((c) => c.type),
          yields: s.yields?.map((y) => y.type),
          risk: s.risk ?? tools.find((t) => t.id === "t:" + id)?.risk ?? [],
          schema: s.schema,
        } as Step;
      });
    const pristine = !held.length && !excluded.length;
    return {
      supported: !missing.length,
      missing,
      steps,
      guard: pristine ? p.guard.status : guard(steps),
      tokens: pristine
        ? p.tokens.plan
        : steps.reduce((n, s) => n + (s.schemaTokens || 120), 0),
      capability: p.capabilities.join(", "),
      baseline: exact.baseline ?? null,
      source: pristine ? ("replay" as const) : ("recording" as const),
    };
  }
  let ids: string[] = [];
  let capability = "";
  if (/scrape|leak|evil|exfil|read my gmail/i.test(task)) {
    ids = ["fetch/fetch", "gmail/search_emails", "gmail/send_email"];
    capability = "data.read_and_send";
  } else if (/pr\b|pull request|branch|commit|flaky/i.test(task)) {
    ids = held.includes("github.branch")
      ? ["github/create_pull_request"]
      : ["github/list_branches", "github/create_pull_request"];
    capability = "code.open_pr";
  } else if (/meet|calendar|invite|schedule|slot/i.test(task)) {
    ids = [
      "google-calendar/list-calendars",
      "google-calendar/get-freebusy",
      "google-calendar/create-event",
    ];
    capability = "calendar.schedule";
  } else if (/linear|bugs|#eng|triage/i.test(task)) {
    ids = [
      "linear/linear_search_issues",
      "slack/slack_get_channel_history",
      "slack/slack_post_message",
    ];
    capability = "issues.summarize";
  } else if (/page|url|fetch|summari[sz]e|https?:/i.test(task)) {
    ids = ["fetch/fetch"];
    capability = "web.read";
  } else if (/file|directory/i.test(task)) {
    ids = ["filesystem/list_directory", "filesystem/read_file"];
    capability = "files.read";
  } else
    return {
      supported: false,
      missing: [],
      steps: [],
      guard: "ok",
      tokens: 0,
      capability: "Unrecognized task",
      baseline: null,
    };
  const missing = ids.filter((id) => excluded.includes(id));
  const steps = ids
    .filter((id) => !excluded.includes(id))
    .map((id, i) => ({
      ...tools.find((t) => t.id === "t:" + id)!,
      id: "t:" + id,
      order: i + 1,
      label: id.split("/")[1],
      server: id.split("/")[0],
      schema: (catalog as Record<string, ToolSchema>)[id],
    }));
  return {
    supported: !missing.length,
    missing,
    steps,
    guard: guard(steps),
    tokens: steps.reduce((n, t) => n + (t.schemaTokens || 120), 0),
    capability,
    baseline: null,
  };
}
