"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import defaultMarkup from "../data/solved-markup.json";
import templates from "../data/plan-templates.json";
import recorded from "../data/recorded-plans.json";
import catalog from "../data/catalog.json";
import { plan } from "../lib/planner";
import { bindStickerDrag } from "../lib/sticker-drag";
import { drawPlan, serverColor, serverIconSvg } from "../lib/plan-diagram";
export default function Planner({
  task,
  budget = 4000,
  onReport,
}: {
  task: string;
  budget?: number;
  onReport: () => void;
}) {
  const initialTask = useRef(task);
  const markup = (templates as Record<string, string>)[task] || defaultMarkup;
  const root = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<string[]>([]),
    [exclude, setExclude] = useState<string[]>([]),
    [graphSlot, setGraphSlot] = useState<HTMLElement | null>(null),
    [whole, setWhole] = useState(false),
    [result, setResult] = useState(() => plan(task)),
    [schema, setSchema] = useState(false);
  useEffect(() => {
    if (held.length || exclude.length || task !== initialTask.current) {
      initialTask.current=task; setResult(plan(task, held, exclude));
    }
  }, [task, held, exclude]);
  useEffect(() => {
    const el = root.current!;
    if (!el) return;
    el.innerHTML = markup;
    const removers: (() => void)[] = [];
    const on = (n: Element, event: string, fn: EventListener) => {
      n.addEventListener(event, fn);
      removers.push(() => n.removeEventListener(event, fn));
    };
    const text = (n: Element) => n.textContent?.trim() || "";
    const graph = el.querySelector(".react-flow") as HTMLElement;
    if (graph) {
      graph.innerHTML = "";
      graph.style.backgroundImage =
        "radial-gradient(#9db08a44 1px,transparent 1px)";
      graph.style.backgroundSize = "24px 24px";
      drawPlan(graph, result, whole);
      setGraphSlot(null);
    }
    const original =
      recorded.plans["Open a PR on acme/api fixing the flaky login test"].plan;
    const known = el.querySelector('[data-dropzone="held"]')!;
    const excluded =
      el.querySelector('[data-dropzone="exclude"]') ||
      el.querySelector('[data-dropzone="excluded"]');
    const drop = (target: Element, kind: string) => {
      on(target, "dragover", (e) => e.preventDefault());
      on(target, "drop", (e) => {
        e.preventDefault();
        const value = (e as DragEvent).dataTransfer?.getData("text/plain");
        if (!value) return;
        if (kind === "held") setHeld((x) => [...new Set([...x, value])]);
        else setExclude((x) => [...new Set([...x, value])]);
      });
    };
    drop(known, "held");
    if (excluded) drop(excluded, "exclude");
    el.querySelectorAll('[role="button"][aria-label]').forEach((n) => {
      const label = n.getAttribute("aria-label") || "";
      const value = label.split(" = ")[0].split(". Space")[0];
      removers.push(
        bindStickerDrag(n as HTMLElement, (x, y) => {
          const inside = (element: Element | null) => {
            if (!element) return false;
            const r = element.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          };
          if (inside(known)) {
            setHeld((v) => [...new Set([...v, value])]);
            return true;
          }
          if (inside(excluded)) {
            setExclude((v) => [...new Set([...v, value])]);
            return true;
          }
          return false;
        }),
      );
      on(n, "dragstart", (e) =>
        (e as DragEvent).dataTransfer?.setData("text/plain", value),
      );
      on(n, "keydown", (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === " ") {
          e.preventDefault();
          n.setAttribute("aria-grabbed", "true");
        }
        if (key === "Enter" && n.getAttribute("aria-grabbed") === "true") {
          e.preventDefault();
          value.includes("/")
            ? setExclude((x) => [...new Set([...x, value])])
            : setHeld((x) => [...new Set([...x, value])]);
          n.setAttribute("aria-grabbed", "false");
        }
      });
    });
    const oldExtras = el.querySelectorAll("[data-local-held]");
    oldExtras.forEach((n) => n.remove());
    for (const v of held) {
      const chip = document.createElement("button");
      chip.dataset.localHeld = "true";
      chip.className = "local-chip";
      chip.textContent = v + " ×";
      chip.onclick = () => setHeld((x) => x.filter((y) => y !== v));
      known.append(chip);
    }
    for (const v of exclude) {
      const chip = document.createElement("button");
      chip.dataset.localHeld = "true";
      chip.className = "local-chip";
      chip.textContent = v + " ×";
      chip.onclick = () => setExclude((x) => x.filter((y) => y !== v));
      (excluded || known).append(chip);
    }
    const record = (
      recorded.plans as unknown as Record<string, { plan: typeof original }>
    )[task]?.plan;
    const normalized = record
      ? record.steps.map((s) => ({
          ...s,
          tool_id: s.tool_id.replace(/^([a-z0-9-]+)\./, "$1/"),
        }))
      : [];
    const mappings: Record<string, string> = {
      "code.open_pr": result.capability,
      "No risky chain":
        result.guard === "blocked" ? "Blocked risky chain" : "No risky chain",
      "304": result.tokens.toLocaleString(),
      "313": result.tokens.toLocaleString(),
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = n.textContent?.trim();
      if (t && mappings[t])
        n.textContent = n.textContent!.replace(t, mappings[t]);
    }
    // Token receipt: pin the big number, the preload total and the savings
    // percentage to the plan's real values. The captured template hard-codes
    // "14,731", which the static "304"/"313" mappings above cannot reach.
    {
      const preload = record?.tokens?.preload_all ?? 110238;
      const pct = Array.from(el.querySelectorAll("b")).find((b) =>
        /fewer tokens$/.test(b.textContent?.trim() || ""),
      );
      const vsLine = pct?.parentElement;
      const numBlock = vsLine?.previousElementSibling;
      const big = numBlock?.querySelector(".tabular-nums") || numBlock;
      const pre = vsLine?.querySelector(".tabular-nums");
      if (big) big.textContent = result.tokens.toLocaleString();
      if (pre) pre.textContent = preload.toLocaleString();
      if (pct)
        pct.textContent =
          ((1 - result.tokens / preload) * 100).toFixed(1) + "% fewer tokens";
    }
    // Compare top-k cards, as on the original when Compare top-k is on. The
    // Vector search column is the recorded BM25 baseline (real tools, real
    // token count, real missing prerequisite); the Switchboard column is the
    // current plan in call order.
    let compare = el.querySelector("[data-local-compare]") as HTMLElement | null;
    if (!compare) {
      const stepsHeading = Array.from(
        el.querySelectorAll("span.mono-label"),
      ).find((n) => n.textContent?.trim() === "Steps");
      const receipt = stepsHeading?.closest("div.relative.min-w-0");
      if (receipt?.parentElement) {
        compare = document.createElement("section");
        compare.setAttribute("data-local-compare", "true");
        compare.setAttribute("aria-label", "Top-k comparison");
        compare.className = "mb-4 grid gap-4 md:grid-cols-2";
        receipt.parentElement.insertBefore(compare, receipt);
      }
    }
    if (compare) {
      compare.classList.add("hidden");
      const baseline = result.baseline;
      const chip = (server: string, label: string) =>
        `<span class="sticker inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] leading-none text-ink" data-tool="${server}/${label}" style="background:${serverColor(server)}">` +
        `<span class="opacity-75">${serverIconSvg(server, 12)}</span>` +
        `<span class="font-bold">${label}</span></span>`;
      const vectorTools = baseline
        ? baseline.tools.map((t) => {
            const [server, label] = [
              t.server_id,
              t.tool_id.replace(/^[^.]+\./, ""),
            ];
            return chip(server, label);
          })
        : [];
      const missing = baseline?.missing?.[0];
      compare.innerHTML =
        `<div class="relative rounded-xl border border-ink/15 bg-card p-4 shadow-stack">` +
        `<div class="flex items-baseline justify-between"><span class="mono-label text-moss">Vector search</span><span class="mono-label tabular-nums">${(baseline?.tokens ?? 0).toLocaleString()} tokens</span></div>` +
        `<div class="mt-3 flex flex-wrap gap-2">${vectorTools.join("")}</div>` +
        (missing
          ? `<div class="stamp mt-4 inline-block -rotate-3 text-tomato">Missing prerequisite<span class="mt-1 block text-[10px] normal-case tracking-normal">${missing.tool_id.replace(/^[^.]+\./, (m) => m.replace(".", "/"))}</span></div>`
          : "") +
        `<p class="mt-3 text-[12px] text-ink/60">No order. A prerequisite is missing.</p></div>` +
        `<div class="rounded-xl border border-ink/15 bg-card p-4 shadow-stack">` +
        `<div class="flex items-baseline justify-between"><span class="mono-label text-moss">Switchboard</span><span class="mono-label tabular-nums">${result.tokens.toLocaleString()} tokens</span></div>` +
        `<div class="mt-3 flex flex-col gap-2">${result.steps
          .map(
            (s, i) =>
              `<span class="sticker inline-flex w-fit items-center gap-2 px-2 py-1 font-mono text-[10px] leading-none text-ink" style="background:${serverColor(s.server)}">` +
              `<span class="grid h-4 w-4 place-items-center rounded-full bg-ink text-[9px] font-bold text-lime">${i + 1}</span>` +
              `<span class="opacity-75">${serverIconSvg(s.server, 12)}</span>` +
              `<span class="font-bold">${s.label}</span></span>`,
          )
          .join("")}</div>` +
        `<p class="mt-3 text-[12px] text-ink/60">In call order. Every input is produced by an earlier step.</p></div>`;
      if (!baseline) compare.classList.add("hidden");
    }
    const btns = Array.from(el.querySelectorAll("button"));
    btns.forEach((b) => {
      const s = text(b);
      if (s === "Whole graph") on(b, "click", () => setWhole(true));
      if (s === "Plan") on(b, "click", () => setWhole(false));
      if (s === "Schemas")
        on(b, "click", () => {
          setSchema((x) => !x);
        });
      if (b.getAttribute("aria-label")?.startsWith("Exclude "))
        on(b, "click", () =>
          setExclude((x) => [...x, b.getAttribute("aria-label")!.slice(8)]),
        );
      if (s === "Compare top-k")
        on(b, "click", () => {
          const section = el.querySelector("[data-local-compare]");
          if (section && result.baseline) section.classList.toggle("hidden");
        });
      if (s === "copy")
        on(b, "click", () => {
          const id = b
            .getAttribute("aria-label")
            ?.replace(/^Copy | schema$/g, "");
          const step = result.steps.find(
            (x) => x.server + "/" + x.label === id,
          );
          const data = id
            ? step?.schema || (catalog as Record<string, unknown>)[id]
            : record?.explain.cypher;
          navigator.clipboard.writeText(
            typeof data === "string"
              ? data
              : JSON.stringify(data || {}, null, 2),
          );
          b.textContent = "copied";
          setTimeout(() => (b.textContent = "copy"), 1000);
        });
      if (s === "✓" || s === "✗")
        on(b, "click", () => {
          b.setAttribute("aria-pressed", "true");
          b.style.background = s === "✓" ? "#d9f94a" : "#ff5a36";
        });
      if (s === "Send report") {
        b.removeAttribute("disabled");
        on(b, "click", () => {
          const reports = JSON.parse(
            localStorage.getItem("sb-local-runs") || "[]",
          );
          reports.unshift({
            task,
            at: new Date().toISOString(),
            ok: !el.querySelector('button[aria-pressed="true"][data-failed]'),
            steps: result.steps.map((s) => ({ tool: s.id.slice(2), ok: true })),
          });
          localStorage.setItem("sb-local-runs", JSON.stringify(reports));
          onReport();
        });
      }
    });
    // The Compare top-k toggle lives in the surrounding page chrome, outside
    // this component's injected markup; bind it from the nearest main scope.
    const barScope = el.closest("main");
    barScope?.querySelectorAll("button").forEach((b) => {
      if (b.textContent?.trim() === "Compare top-k")
        on(b, "click", () => {
          const section = el.querySelector("[data-local-compare]");
          if (section && result.baseline) section.classList.toggle("hidden");
        });
    });
    // Keep the exact reference card layout while binding its step cards to the current plan.
    if (
      held.length ||
      exclude.length ||
      !("source" in result && result.source === "replay")
    ) {
      const list = el.querySelector('ol[aria-label="Ordered plan steps"]');
      const sample = list?.firstElementChild?.cloneNode(true) as
        HTMLElement | undefined;
      if (list && sample) {
        list.replaceChildren();
        result.steps.forEach((step, i) => {
          const row = sample.cloneNode(true) as HTMLElement;
          const spans = row.querySelectorAll(".min-w-0.flex-1 > span");
          if (spans[0]) spans[0].textContent = step.server + "/" + step.label;
          if (spans[1])
            spans[1].textContent =
              (step.consumes || [])
                .map((t) => t + (held.includes(t) ? "←held" : ""))
                .join(" · ") +
              " → " +
              (step.yields || []).join(", ");
          const order = row.querySelector(".rounded-full");
          if (order) order.textContent = String(i + 1);
          const tokens = row.querySelector(".mono-label");
          if (tokens) tokens.textContent = (step.schemaTokens || 120) + "t";
          const copy = row.querySelector("button");
          if (copy) {
            copy.setAttribute(
              "aria-label",
              "Copy " + step.server + "/" + step.label + " schema",
            );
            copy.onclick = () =>
              navigator.clipboard.writeText(
                JSON.stringify(
                  step.schema ||
                    (catalog as Record<string, unknown>)[step.id.slice(2)] ||
                    {},
                  null,
                  2,
                ),
              );
          }
          list.append(row);
        });
      }
      const total = record?.tokens.plan;
      const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (texts.nextNode()) {
        const n = texts.currentNode,
          t = n.textContent?.trim();
        if (t && total && t === total.toLocaleString())
          n.textContent = result.tokens.toLocaleString();
      }
    }
    // Keep every edited-plan receipt and path chip synchronized with the graph.
    const summaryText=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    while(summaryText.nextNode()){
      const n=summaryText.currentNode;
      if(/^Total,?\s*\d+ calls?$/.test(n.textContent?.trim()||""))n.textContent=`Total, ${result.steps.length} calls`;
    }
    const stepsList=el.querySelector('ol[aria-label="Ordered plan steps"]');
    const totals=stepsList?.parentElement?.querySelector(".mt-2.flex.justify-between");
    if(totals)totals.innerHTML=`<span class="tabular-nums">Total, ${result.steps.length} calls</span><span class="tabular-nums">${result.tokens.toLocaleString()} tokens</span>`;
    const planChips=Array.from(el.querySelectorAll(".diff-item[data-flip-id]"));
    planChips.forEach((b,i)=>{if(!result.steps[i])b.remove();else b.textContent=`${i+1} ${result.steps[i].server}/${result.steps[i].label}`;});
    const stageRows = Array.from(el.querySelectorAll("aside"))
      .at(-1)
      ?.querySelectorAll("li");
    if (stageRows)
      gsap.fromTo(
        stageRows,
        { opacity: 0.2 },
        { opacity: 1, stagger: 0.07, duration: 0.2 },
      );
    return () => {
      removers.forEach((f) => f());
      setGraphSlot(null);
    };
  }, [task, result, held, exclude, whole]);
  return (
    <div className="faithful-planner">
      <div ref={root} dangerouslySetInnerHTML={{ __html: markup }} />
      {graphSlot &&
        createPortal(
          whole ? (
            <iframe
              src="/explore?embed=1"
              title="Whole graph"
              style={{ height: "100%", width: "100%", border: 0 }}
            />
          ) : (
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 850 430"
              aria-label="Plan in call order"
              style={{ overflow: "visible" }}
            >
              <defs>
                <filter id="plan-shadow">
                  <feDropShadow
                    dx="0"
                    dy="3"
                    stdDeviation="1.5"
                    floodOpacity=".13"
                  />
                </filter>
              </defs>
              <g fontFamily="Geist Mono, monospace">
                <rect
                  x="30"
                  y="160"
                  width="155"
                  height="38"
                  rx="8"
                  fill="#f6f1e4"
                  stroke="#9db08a"
                />
                <text x="42" y="184" fontSize="12" fill="#526e2d">
                  held · text.query
                </text>
                <rect
                  x="30"
                  y="270"
                  width="155"
                  height="38"
                  rx="8"
                  fill="#f6f1e4"
                  stroke="#9db08a"
                />
                <text x="42" y="294" fontSize="12" fill="#526e2d">
                  held · session
                </text>
                {result.steps.map((s, i) => {
                  const x = 250 + (i % 2) * 300,
                    y = 160 + Math.floor(i / 2) * 145;
                  return (
                    <g
                      key={s.id}
                      className="local-step"
                      style={{
                        background: "none",
                        boxShadow: "none",
                        border: 0,
                      }}
                    >
                      <path
                        d={
                          i === 0
                            ? `M185 288 C220 288 220 220 ${x} ${y + 26}`
                            : `M${x - 70} ${y + 26} L${x} ${y + 26}`
                        }
                        fill="none"
                        stroke="#1f2a1c"
                        strokeWidth="9"
                      />
                      <path
                        d={
                          i === 0
                            ? `M185 288 C220 288 220 220 ${x} ${y + 26}`
                            : `M${x - 70} ${y + 26} L${x} ${y + 26}`
                        }
                        fill="none"
                        stroke={
                          result.guard === "blocked" ? "#ff5a36" : "#d9f94a"
                        }
                        strokeWidth="5"
                      />
                      <rect
                        x={x}
                        y={y}
                        width="215"
                        height="58"
                        rx="25"
                        fill="#a4b98e"
                        stroke="#1f2a1c"
                        strokeWidth="3"
                        filter="url(#plan-shadow)"
                      />
                      <rect
                        x={x + 5}
                        y={y + 5}
                        width="205"
                        height="48"
                        rx="20"
                        fill="none"
                        stroke="#f6f1e4"
                        strokeWidth="3"
                      />
                      <circle cx={x + 24} cy={y + 30} r="10" fill="#1f2a1c" />
                      <text x={x + 21} y={y + 34} fill="#f6f1e4" fontSize="11">
                        {i + 1}
                      </text>
                      <text x={x + 45} y={y + 21} fill="#526e2d" fontSize="10">
                        {s.server}
                      </text>
                      <text
                        x={x + 45}
                        y={y + 39}
                        fill="#1f2a1c"
                        fontSize="12"
                        fontWeight="700"
                      >
                        {s.label.length > 22
                          ? s.label.slice(0, 21) + "…"
                          : s.label}
                      </text>
                    </g>
                  );
                })}
                {result.guard === "blocked" && (
                  <text
                    x="250"
                    y="385"
                    fontSize="22"
                    fill="#ff5a36"
                    fontWeight="700"
                  >
                    BLOCKED · unsafe chain cut
                  </text>
                )}
                {!result.supported && (
                  <text x="250" y="370" fontSize="16" fill="#ff5a36">
                    No complete local plan
                  </text>
                )}
              </g>
            </svg>
          ),
          graphSlot,
        )}
      {schema &&
        createPortal(
          <div className="schema-overlay" onClick={() => setSchema(false)}>
            <aside
              id="local-schema-section"
              className="schema-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Schemas on this path"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSchema(false)}
                style={{ float: "right", fontSize: 24 }}
                aria-label="Close schemas"
              >
                ×
              </button>
              <h2 style={{ fontSize: 24, fontFamily: "var(--font-clash)" }}>
                Schemas on this path
              </h2>
              <p style={{ fontSize: 12, opacity: 0.65 }}>
                In call order. Your agent loads {result.tokens.toLocaleString()}{" "}
                tokens instead of 110,238.
              </p>
              <button
                className="local-chip"
                style={{ width: "100%", margin: "24px 0" }}
                onClick={() =>
                  navigator.clipboard.writeText(
                    JSON.stringify(
                      result.steps.map(
                        (s) =>
                          s.schema ||
                          (catalog as Record<string, unknown>)[
                            s.id.slice(2)
                          ] || {
                            name: s.label,
                            description: s.desc,
                          },
                      ),
                      null,
                      2,
                    ),
                  )
                }
              >
                Copy as MCP tool list
              </button>
              {result.steps.map((s, i) => (
                <details
                  key={s.id}
                  open={i === 0}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid #9db08a44",
                  }}
                >
                  <summary
                    style={{
                      font: "12px Geist Mono,monospace",
                      cursor: "pointer",
                    }}
                  >
                    {i + 1} {s.server}/{s.label}{" "}
                    <small style={{ float: "right" }}>
                      {s.schemaTokens} tokens
                    </small>
                  </summary>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 10,
                      background: "#141c12",
                      color: "#f6f1e4",
                      padding: 16,
                      borderRadius: 8,
                      marginTop: 12,
                      maxHeight: "58vh",
                      overflow: "auto",
                    }}
                  >
                    {JSON.stringify(
                      s.schema ||
                        (catalog as Record<string, unknown>)[s.id.slice(2)] || {
                          name: s.label,
                          description: s.desc,
                        },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
            </aside>
          </div>,
          document.body,
        )}
      {result.tokens > budget && (
        <p role="alert" style={{ color: "#ff5a36", padding: 16 }}>
          Plan exceeds the token budget.
        </p>
      )}
    </div>
  );
}
