import gsap from "gsap";

const NS = "http://www.w3.org/2000/svg";
const INK = "#1F2A1C";
const LIME = "#D9F94A";
const TOMATO = "#FF5A36";
const MOSS = "#4E6B3A";
const DEFAULT_MESSAGE =
  "Press run to watch an unguarded agent build this chain.";
const EDGE_BASE: Record<string, string> = {
  stroke: INK,
  "stroke-dasharray": "2 10",
  "stroke-linecap": "round",
  "stroke-opacity": "0.3",
  "stroke-width": "6",
};
const LEG_LABELS = ["Private data", "Untrusted input", "Sends out"];
const LEG_COLORS = ["#FFC8DD", "#FFE66D", "#FF5A36"];

let active: gsap.core.Timeline | null = null;

function chainSvg(root: HTMLElement): SVGSVGElement | null {
  return root.querySelector('svg[aria-label^="Chain"]');
}

function legCards(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll("main div.rounded-xl, main div.rounded-lg"),
  ).filter(
    (n) =>
      /^Private data|^Untrusted input|^Sends out/.test(
        n.textContent?.trim() || "",
      ) && n.children.length < 5,
  ) as HTMLElement[];
}

function legActive(root: HTMLElement, label: string): boolean {
  return Array.from(root.querySelectorAll("main button[aria-label]")).some(
    (b) =>
      b.getAttribute("aria-label")?.endsWith(": " + label) &&
      b.getAttribute("aria-pressed") === "true",
  );
}

function verdictSentence(root: HTMLElement, blocked: boolean): string {
  const p = Array.from(root.querySelectorAll("main p")).find((n) => {
    const t = n.textContent?.trim() || "";
    return t.startsWith("Blocked.") || t.startsWith("Allowed.");
  });
  const t = p?.textContent?.trim() || "";
  return blocked ? t.replace(/^Blocked\.\s*/, "") : t;
}

function restoreSvg(svg: SVGSVGElement) {
  svg.querySelectorAll("[data-guard-motion]").forEach((n) => n.remove());
  svg.querySelectorAll("line.g-edge").forEach((e) => {
    for (const [k, v] of Object.entries(EDGE_BASE)) e.setAttribute(k, v);
    e.removeAttribute("style");
    e.removeAttribute("opacity");
  });
  svg.querySelectorAll(":scope > g").forEach((g) => {
    (g as SVGElement).style.removeProperty("opacity");
    if (g.hasAttribute("opacity")) g.setAttribute("opacity", "1");
    const inner = g.querySelector(".g-node");
    if (inner) (inner as SVGElement).style.removeProperty("opacity");
  });
  if (svg.dataset.guardLabelBase)
    svg.setAttribute("aria-label", svg.dataset.guardLabelBase);
}

/**
 * Restore the Guard demo to its pre-run state: removes injected motion
 * elements, restores edges, node opacity, the message line, the verdict
 * stamp and the three-legs panel. Call this when the scenario changes or
 * before starting a new run.
 */
export function resetGuard(root: HTMLElement) {
  if (active) {
    active.kill();
    active = null;
  }
  const svg = chainSvg(root);
  if (svg) restoreSvg(svg);
  const wrapper = svg?.parentElement;
  const message = wrapper?.querySelector("p");
  if (message) message.textContent = DEFAULT_MESSAGE;
  const badge = wrapper?.querySelector(".absolute.right-4") as HTMLElement;
  if (badge) {
    badge.innerHTML = "";
    badge.removeAttribute("style");
  }
  legCards(root).forEach((c) => {
    c.style.background = "";
    c.style.color = "";
    c.style.borderColor = "";
  });
}

function energize(edge: Element | undefined, timeline: gsap.core.Timeline, at: number) {
  if (!edge) return;
  const x1 = parseFloat(edge.getAttribute("x1") || "0");
  const y1 = parseFloat(edge.getAttribute("y1") || "0");
  const x2 = parseFloat(edge.getAttribute("x2") || "0");
  const y2 = parseFloat(edge.getAttribute("y2") || "0");
  const len = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  timeline.call(
    () => {
      edge.setAttribute("stroke", LIME);
      edge.setAttribute("stroke-opacity", "1");
    },
    [],
    at,
  );
  timeline.fromTo(
    edge,
    { attr: { "stroke-dasharray": `${len}, 0.1`, "stroke-dashoffset": len } },
    { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power1.out" },
    at,
  );
}

const SCISSORS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12 12 12"></path><path d="M20 4 8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8 20 20"></path></svg>';

function cutEdge(
  svg: SVGSVGElement,
  edge: Element | undefined,
  timeline: gsap.core.Timeline,
  at: number,
) {
  if (!edge) return;
  const x1 = parseFloat(edge.getAttribute("x1") || "454");
  const y = parseFloat(edge.getAttribute("y1") || "200");
  const x2 = parseFloat(edge.getAttribute("x2") || "556");
  const cutA = x1 + (x2 - x1) * 0.36;
  const cutB = x1 + (x2 - x1) * 0.64;
  const group = document.createElementNS(NS, "g");
  group.dataset.guardMotion = "true";
  const half1 = document.createElementNS(NS, "line");
  for (const [k, v] of Object.entries({
    x1: String(x1),
    y1: String(y),
    x2: String(cutA),
    y2: String(y),
    stroke: TOMATO,
    "stroke-width": "6",
    "stroke-linecap": "round",
    "stroke-opacity": "0.45",
  }))
    half1.setAttribute(k, v);
  const half2 = document.createElementNS(NS, "line");
  for (const [k, v] of Object.entries({
    x1: String(cutB),
    y1: String(y),
    x2: String(x2),
    y2: String(y),
    stroke: TOMATO,
    "stroke-width": "6",
    "stroke-linecap": "round",
    "stroke-opacity": "0.45",
  }))
    half2.setAttribute(k, v);
  const scissorWrap = document.createElementNS(NS, "g");
  scissorWrap.setAttribute(
    "transform",
    `translate(${(cutA + cutB) / 2} ${y - 44})`,
  );
  const scissors = document.createElementNS(NS, "g");
  scissors.setAttribute("class", "g-scissors");
  scissors.setAttribute("color", TOMATO);
  scissors.innerHTML = SCISSORS_SVG;
  scissorWrap.append(scissors);
  group.append(half1, half2, scissorWrap);
  timeline.call(
    () => {
      (edge as SVGElement).setAttribute("opacity", "0");
      svg.append(group);
    },
    [],
    at,
  );
  timeline.to(
    half1,
    {
      rotation: -40,
      svgOrigin: `${x1} ${y}`,
      opacity: 0,
      duration: 0.9,
      ease: "power2.out",
    },
    at + 0.15,
  );
  timeline.to(
    half2,
    {
      rotation: 50,
      svgOrigin: `${(cutA + cutB) / 2} ${y}`,
      opacity: 0,
      duration: 0.9,
      ease: "power2.out",
    },
    at + 0.15,
  );
  timeline.fromTo(
    scissors,
    { scale: 0, rotation: -30, transformOrigin: "50% 50%" },
    { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2)" },
    at,
  );
  timeline.to(
    scissors,
    { rotation: 14, yoyo: true, repeat: 3, duration: 0.08 },
    at + 0.55,
  );
}

function drawSafe(svg: SVGSVGElement, timeline: gsap.core.Timeline, at: number) {
  const group = document.createElementNS(NS, "g");
  group.dataset.guardMotion = "true";
  group.setAttribute("class", "g-safe");
  const path = document.createElementNS(NS, "path");
  for (const [k, v] of Object.entries({
    d: "M 130 232 C 130 310, 320 322, 390 322",
    fill: "none",
    stroke: LIME,
    "stroke-width": "6",
    "stroke-linecap": "round",
  }))
    path.setAttribute(k, v);
  const pill = document.createElementNS(NS, "g");
  pill.setAttribute("transform", "translate(492 322)");
  const rect = document.createElementNS(NS, "rect");
  for (const [k, v] of Object.entries({
    x: "-102",
    y: "-22",
    width: "204",
    height: "44",
    rx: "10",
    fill: LIME,
    stroke: INK,
    "stroke-width": "1.5",
  }))
    rect.setAttribute(k, v);
  const label = document.createElementNS(NS, "text");
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("y", "5");
  label.setAttribute("font-size", "14");
  label.setAttribute("font-weight", "700");
  label.setAttribute("fill", INK);
  label.textContent = "Summarize, nothing else";
  pill.append(rect, label);
  group.append(path, pill);
  timeline.call(
    () => {
      svg.append(group);
      const len = path.getTotalLength();
      gsap.fromTo(
        path,
        { attr: { "stroke-dasharray": `${len}, 0.1`, "stroke-dashoffset": len } },
        { attr: { "stroke-dashoffset": 0 }, duration: 0.6, ease: "power1.out" },
      );
      gsap.fromTo(
        pill,
        { scale: 0.6, opacity: 0, transformOrigin: "492px 322px" },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
      );
    },
    [],
    at,
  );
}

function makeStamp(
  badge: HTMLElement,
  tone: "tomato" | "moss",
  label: string,
  deg: number,
  timeline: gsap.core.Timeline,
  at: number,
) {
  timeline.call(
    () => {
      badge.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "g-stamp";
      const stamp = document.createElement("div");
      stamp.dataset.tone = tone;
      stamp.className = "stamp inline-block text-sm bg-card/90";
      stamp.setAttribute("role", "status");
      const dark = document.documentElement.classList.contains("dark");
      stamp.style.cssText = [
        `color:${tone === "tomato" ? TOMATO : MOSS}`,
        "font-family:'Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace",
        "text-transform:uppercase",
        "letter-spacing:0.1em",
        'filter:url("#stamp-rough")',
        `mix-blend-mode:${dark ? "normal" : "multiply"}`,
        "border:3px solid",
        "border-radius:8px",
        "padding:6px 12px",
        "font-weight:700",
        "font-size:14px",
        "background:color-mix(in srgb, var(--card, #fbf8ef) 90%, transparent)",
      ].join(";");
      stamp.textContent = label;
      wrap.append(stamp);
      badge.append(wrap);
      gsap.fromTo(
        stamp,
        { scale: 1.7, rotation: deg * 2.5, opacity: 0 },
        {
          scale: 1,
          rotation: deg,
          opacity: 1,
          duration: 0.45,
          ease: "back.out(2)",
        },
      );
    },
    [],
    at,
  );
}

export function animateGuard(root: HTMLElement, blocked: boolean) {
  const svg = chainSvg(root);
  if (!svg) return;
  resetGuard(root);
  if (!svg.dataset.guardLabelBase)
    svg.dataset.guardLabelBase = svg.getAttribute("aria-label") || "";
  const wrapper = svg.parentElement!;
  const message = wrapper.querySelector("p")!;
  const badge = wrapper.querySelector(".absolute.right-4") as HTMLElement;
  const nodeWraps = Array.from(
    svg.querySelectorAll(":scope > g[transform]"),
  ) as SVGGElement[];
  const nodes = nodeWraps
    .map((w) => w.querySelector(".g-node"))
    .filter((n): n is Element => !!n);
  const edges = svg.querySelectorAll("line.g-edge");
  const cards = legCards(root);

  const ring = document.createElementNS(NS, "circle");
  ring.dataset.guardMotion = "true";
  for (const [k, v] of Object.entries({
    cx: "130",
    cy: "200",
    r: "18",
    fill: LIME,
    stroke: INK,
    "stroke-width": "4",
  }))
    ring.setAttribute(k, v);

  const timeline = gsap.timeline();
  active = timeline;
  timeline
    .call(() => {
      svg.append(ring);
      message.textContent = "The agent is reading the page.";
    })
    .set(nodes, { opacity: 0.28 })
    .to(nodes[0], { opacity: 1, duration: 0.25 }, 0)
    .to(ring, { attr: { cx: 380 }, duration: 0.7, ease: "power2.inOut" }, 0.6)
    .to(nodes[1], { opacity: 1, duration: 0.25 }, 1.15)
    .call(
      () => {
        message.textContent =
          "The page asks for private mail. The agent follows it.";
        cards.forEach((n, i) => {
          if (!legActive(root, LEG_LABELS[i])) return;
          n.style.background = LEG_COLORS[i];
          n.style.color = INK;
        });
      },
      [],
      1.25,
    );
  energize(edges[0], timeline, 1.3);
  timeline.to(
    ring,
    {
      attr: { cx: blocked ? 505 : 630 },
      duration: 0.7,
      ease: "power2.inOut",
    },
    1.8,
  );
  if (blocked) {
    timeline.call(
      () => {
        ring.style.display = "none";
        message.textContent =
          "Cut before it runs. The agent can still summarize the page.";
        if (nodeWraps[2]) gsap.to(nodeWraps[2], { opacity: 0.35, duration: 0.3 });
        if (svg.dataset.guardLabelBase) {
          const base = svg.dataset.guardLabelBase.replace(/\s+$/, "");
          const extra = verdictSentence(root, true);
          svg.setAttribute(
            "aria-label",
            extra ? base + " " + extra : base,
          );
        }
      },
      [],
      2.5,
    );
    cutEdge(svg, edges[1], timeline, 2.5);
    drawSafe(svg, timeline, 2.7);
    makeStamp(badge, "tomato", "blocked", -6, timeline, 2.6);
  } else {
    timeline.call(
      () => {
        ring.style.display = "none";
        message.textContent = "Nothing to cut. This chain runs.";
        if (svg.dataset.guardLabelBase) {
          const base = svg.dataset.guardLabelBase.replace(/\s+$/, "");
          const extra = verdictSentence(root, false);
          svg.setAttribute(
            "aria-label",
            extra ? base + " " + extra : base,
          );
        }
      },
      [],
      2.5,
    );
    energize(edges[1], timeline, 2.5);
    timeline.to(nodes[2], { opacity: 1, duration: 0.3 }, 2.5);
    makeStamp(badge, "moss", "allowed", -5, timeline, 2.6);
  }
  return timeline;
}
