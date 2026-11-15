import type { GuardRejection, GuardVerdict, PlanStep, RiskFlag, ToolNode } from './types.js';

const LEG_LABEL: Record<string, string> = {
  reads_private: 'reads private data',
  ingests_untrusted: 'ingests untrusted content',
  exfil_sink: 'can send data out',
  destructive: 'is destructive',
};

/**
 * Simon Willison's lethal trifecta, checked at plan time:
 * a chain combining private data + untrusted input + a way out is cut before anything runs.
 * Flags are ingest-time heuristics; a wrong flag gives a wrong verdict.
 */
export function checkGuard(steps: PlanStep[], tools: ToolNode[], allowDestructive: boolean): GuardVerdict {
  const flagsOf = (i: number) => new Set(tools[i]?.risk ?? []);
  const legs = new Set<RiskFlag>();
  for (let i = 0; i < steps.length; i++) for (const f of flagsOf(i)) legs.add(f);

  const rejected: GuardRejection[] = [];
  const has = (l: RiskFlag) => legs.has(l);

  if (has('reads_private') && has('ingests_untrusted') && has('exfil_sink')) {
    const byLeg = (l: RiskFlag) => steps.filter((_, i) => flagsOf(i).has(l)).map((s) => s.tool_id);
    // name the deliberate send/post first; incidental sinks (scrape, navigate) after
    const order = steps.map((s, i) => i).sort((a, b) =>
      Number(/send|post|email|upload|share|message/.test(steps[b].tool_id)) - Number(/send|post|email|upload|share|message/.test(steps[a].tool_id)) || a - b);
    for (const i of order) {
      if (!flagsOf(i).has('exfil_sink')) continue;
      const priv = steps.filter((_, j) => flagsOf(j).has('reads_private')).map((s) => s.tool_id);
      const untrusted = steps.filter((_, j) => flagsOf(j).has('ingests_untrusted')).map((s) => s.tool_id);
      const sink = steps[i].tool_id;
      const untrustedOther = untrusted.find((t) => t !== priv[0]) ?? untrusted[0];
      const reason = `Lethal trifecta: ${priv[0]} reads private data, ${untrustedOther} ingests untrusted content, and ${sink} can send data out. Injected text from ${untrustedOther} could exfiltrate what ${priv[0]} read.`;
      rejected.push({
        path: steps.slice(0, i + 1).map((s) => s.tool_id),
        legs: ['reads_private', 'ingests_untrusted', 'exfil_sink'],
        tools_by_leg: { reads_private: priv, ingests_untrusted: untrusted, exfil_sink: byLeg('exfil_sink') },
        cut_edge: [steps[Math.max(0, i - 1)].tool_id, sink],
        reason,
      });
    }
    return {
      status: 'blocked',
      reason: rejected[0].reason,
      rejected,
      legs_present: [...legs],
      note: 'The trifecta guard mitigates prompt-injection exfiltration at plan time. It is not a complete defense.',
    };
  }

  if (!allowDestructive && has('destructive')) {
    for (let i = 0; i < steps.length; i++) {
      if (!flagsOf(i).has('destructive')) continue;
      rejected.push({
        path: [steps[i].tool_id],
        legs: ['destructive'],
        tools_by_leg: { destructive: [steps[i].tool_id] },
        cut_edge: [steps[Math.max(0, i - 1)].tool_id, steps[i].tool_id],
        reason: `${steps[i].tool_id} ${LEG_LABEL.destructive}; resubmit with allow_destructive to run it.`,
      });
    }
    return { status: 'review', reason: rejected[0]?.reason, rejected, legs_present: [...legs] };
  }

  return { status: 'ok', rejected: [], legs_present: [...legs] };
}
