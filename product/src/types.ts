export type RiskFlag = 'reads_private' | 'ingests_untrusted' | 'exfil_sink' | 'destructive';

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface Consume {
  param: string;
  type: string;
}

export interface Yield {
  field: string;
  type: string;
}

export interface ToolNode {
  /** canonical id: "server/tool" */
  id: string;
  server: string;
  name: string;
  description: string;
  consumes: Consume[];
  yields: Yield[];
  risk: RiskFlag[];
  schemaTokens: number;
  schema?: ToolSchema;
}

export interface ServerInfo {
  id: string;
  name?: string;
  url?: string;
  tools?: number;
}

export interface Catalog {
  generated_at?: string;
  provenance?: string;
  servers: ServerInfo[];
  types: string[];
  tools: ToolNode[];
}

export interface Held {
  type: string;
  value?: string;
  source: string;
}

export interface PlanStep {
  order: number;
  tool_id: string; // dotted "server.tool"
  server_id: string;
  role: 'prerequisite' | 'goal';
  consumes: { param: string; type: string; from: string }[];
  yields: Yield[];
  risk?: RiskFlag[];
  schema?: ToolSchema;
  schema_tokens: number;
}

export interface GuardRejection {
  path: string[];
  legs: RiskFlag[];
  tools_by_leg: Record<string, string[]>;
  cut_edge: [string, string];
  reason: string;
}

export interface GuardVerdict {
  status: 'ok' | 'blocked' | 'review';
  reason?: string;
  rejected: GuardRejection[];
  legs_present?: RiskFlag[];
  note?: string;
}

export interface Plan {
  plan_id: string;
  task: string;
  capabilities: string[];
  held: Held[];
  steps: PlanStep[];
  tokens: { plan: number; preload_all: number; saved: number };
  guard: GuardVerdict;
  notes?: string[];
  explain: { cypher: string | null; ms: number; transport: string; paths?: number };
}

export interface PlanRequest {
  task: string;
  held?: { type: string; value?: string }[];
  exclude?: string[];
  allow_destructive?: boolean;
  account?: string;
}

export interface RunReport {
  task?: string;
  plan_id?: string;
  account?: string;
  steps: { tool_id: string; worked: boolean }[];
  held?: { type: string; value: string }[];
}
