// Runs page interactions: scrub slider (keyboard + pointer) and journal
// expansion. Isolated module; Experience.tsx only calls
// initRunsInteractions(main) and re-calls it after each tab swap.
//
// Behaviour replicated from the original site (switchhboard.vercel.app/runs):
// - Slider value N shows runs 1..N chronologically: journal cards and graph
//   nodes/edges filter, aria-valuenow and the "N of 4" label update.
// - Keyboard: ArrowLeft/Down -1, ArrowRight/Up +1, Home/End clamp.
// - Pointer: drag the thumb or click the track; snaps to the nearest stop.
// - Journal cards expand accordion-style with plan/run ids, "wrote back"
//   specimens and a "Plan it again" link to /ask?task=<task>.

const STOPS = 4;
const TICK_PCT = [12.5, 37.5, 62.5, 87.5]; // matches the tick marks in the template

// Chronological run data (r-001 oldest .. r-004 newest), as shipped in the
// journal markup and confirmed against the original site's expansion panels.
const RUNS = [
  {
    n: 1,
    tools: ["create_branch", "get_file_contents", "create_or_update_file", "create_pull_request"],
    plan: "replay-open-pr-1",
    run: "r-001",
    wrote: ["branch.name = fix/flaky-login", "pr.number = #482"],
    q: "Open a PR on acme/api fixing the flaky login test",
  },
  {
    n: 2,
    tools: ["get-current-time", "get-freebusy", "create-event"],
    plan: "replay-meeting-1",
    run: "r-002",
    wrote: ["calendar.event = evt_7f3a"],
    q: "Find a free meeting slot next week and send the invite",
  },
  {
    n: 3,
    tools: ["linear_search_issues", "slack_get_channel_history", "slack_post_message"],
    plan: "replay-triage-1",
    run: "r-003",
    wrote: [],
    q: "Find open login bugs in Linear and post a summary to #eng",
  },
  {
    n: 4,
    tools: ["create_branch", "get_file_contents", "create_or_update_file", "create_pull_request"],
    plan: "replay-open-pr-2",
    run: "r-004",
    wrote: ["repo.ref = acme/web"],
    q: "Open a PR on acme/web bumping the eslint config",
  },
];

const DETAIL_CLASS = "mt-4 border-t border-ink/10 pt-3 text-[13px]";

function toolsUpTo(value: number): Set<string> {
  const s = new Set<string>();
  RUNS.forEach((r) => {
    if (r.n <= value) r.tools.forEach((t) => s.add(t));
  });
  return s;
}

function graphNodes(svg: SVGSVGElement): SVGGElement[] {
  return Array.from(svg.querySelectorAll("g")).filter((g) =>
    g.querySelector("text"),
  ) as SVGGElement[];
}

function nodeName(g: SVGGElement): string {
  const raw = (g.querySelector("text")?.textContent || "").trim();
  const prefix = raw.replace(/…$/, "");
  const all = Array.from(new Set(RUNS.flatMap((r) => r.tools)));
  return all.find((t) => t === raw) || all.find((t) => t.startsWith(prefix)) || raw;
}

function nodeCenter(g: SVGGElement): [number, number] {
  const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(
    g.getAttribute("transform") || "",
  );
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
}

function pathEnds(d: string): [[number, number], [number, number]] | null {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number);
  if (!nums || nums.length < 4) return null;
  return [
    [nums[0], nums[1]],
    [nums[nums.length - 2], nums[nums.length - 1]],
  ];
}

function nearest(center: [number, number], nodes: SVGGElement[]): SVGGElement | null {
  let best: SVGGElement | null = null;
  let bd = Infinity;
  nodes.forEach((g) => {
    const [x, y] = nodeCenter(g);
    const d = Math.hypot(center[0] - x, center[1] - y);
    if (d < bd) {
      bd = d;
      best = g;
    }
  });
  return bd < 90 ? best : null;
}

function buildDetail(run: (typeof RUNS)[number]): HTMLElement {
  const div = document.createElement("div");
  div.className = DETAIL_CLASS;
  div.setAttribute("data-runs-detail", run.run);
  const ids = document.createElement("div");
  ids.className = "break-all font-mono text-[12px] text-ink/50";
  ids.textContent = `plan ${run.plan} · run ${run.run}`;
  div.append(ids);
  if (run.wrote.length) {
    const w = document.createElement("div");
    w.className = "mt-2";
    w.append("wrote back: ");
    run.wrote.forEach((s) => {
      const sp = document.createElement("span");
      sp.className = "specimen mr-1";
      sp.textContent = s;
      w.append(sp);
    });
    div.append(w);
  }
  const a = document.createElement("a");
  a.className =
    "btn-spring mt-3 inline-block rounded-lg bg-ink px-4 py-1.5 font-bold text-lime";
  a.href = "/ask?task=" + encodeURIComponent(run.q);
  a.textContent = "Plan it again";
  div.append(a);
  return div;
}

export function initRunsInteractions(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ) => {
    el.addEventListener(type, fn);
    cleanups.push(() => el.removeEventListener(type, fn));
  };

  const slider = root.querySelector<HTMLElement>('[role="slider"]');
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>("li.journal-entry"),
  );
  const section = slider?.closest("section");
  const svg = section?.querySelector<SVGSVGElement>('svg[role="img"]');

  // ---- journal expansion (accordion) ----
  cards.forEach((li, domIdx) => {
    const btn = li.querySelector<HTMLElement>("button");
    if (!btn) return;
    const run = RUNS[RUNS.length - 1 - domIdx]; // DOM is newest-first
    if (!run) return;
    on(btn, "click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      cards.forEach((other) => {
        other
          .querySelector("button")
          ?.setAttribute("aria-expanded", "false");
        other.querySelector("[data-runs-detail]")?.remove();
      });
      if (!open) {
        btn.setAttribute("aria-expanded", "true");
        li.append(buildDetail(run));
      }
    });
  });

  if (!slider) return () => cleanups.forEach((f) => f());

  const thumb = slider.querySelector<HTMLElement>(".sticker");
  const labelMid =
    slider.previousElementSibling?.querySelectorAll("span")[1];
  const max = Number(slider.getAttribute("aria-valuemax")) || STOPS;
  let value = Number(slider.getAttribute("aria-valuenow")) || max;

  const stopX = (v: number): number => {
    const track = slider.clientWidth;
    const tw = thumb?.offsetWidth || 0;
    return ((TICK_PCT[v - 1] ?? 87.5) / 100) * track - tw / 2;
  };

  function apply(v: number, moveThumb = true) {
    value = Math.min(max, Math.max(1, v));
    slider!.setAttribute("aria-valuenow", String(value));
    if (thumb) {
      thumb.textContent = String(value);
      if (moveThumb)
        thumb.style.transform = `translate3d(${stopX(value)}px, 0px, 0px)`;
    }
    if (labelMid) labelMid.textContent = `${value} of ${max}`;
    const visible = toolsUpTo(value);
    cards.forEach((li, domIdx) => {
      const runN = RUNS.length - domIdx;
      li.style.display = runN <= value ? "" : "none";
    });
    if (svg) {
      const nodes = graphNodes(svg);
      const hidden = new Set<SVGGElement>();
      nodes.forEach((g) => {
        const show = visible.has(nodeName(g));
        g.style.display = show ? "" : "none";
        if (!show) hidden.add(g);
      });
      svg.querySelectorAll<SVGPathElement>("path[d]").forEach((p) => {
        const ends = pathEnds(p.getAttribute("d") || "");
        if (!ends) return;
        const a = nearest(ends[0], nodes);
        const b = nearest(ends[1], nodes);
        const hide =
          (a && hidden.has(a)) || (b && hidden.has(b)) || false;
        (p as unknown as HTMLElement).style.display = hide ? "none" : "";
      });
    }
  }

  on(slider, "keydown", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "ArrowDown") {
      e.preventDefault();
      apply(value - 1);
    } else if (k === "ArrowRight" || k === "ArrowUp") {
      e.preventDefault();
      apply(value + 1);
    } else if (k === "Home") {
      e.preventDefault();
      apply(1);
    } else if (k === "End") {
      e.preventDefault();
      apply(max);
    }
  });

  // pointer scrub: drag the thumb or press anywhere on the track
  let dragging = false;
  const fromEvent = (clientX: number): number => {
    const r = slider.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    let best = 1;
    let bd = Infinity;
    TICK_PCT.forEach((p, i) => {
      const d = Math.abs(pct - p);
      if (d < bd) {
        bd = d;
        best = i + 1;
      }
    });
    return best;
  };
  on(slider, "pointerdown", (e) => {
    dragging = true;
    slider.setPointerCapture?.(e.pointerId);
    // preventDefault keeps the drag from selecting text but also blocks
    // native focus; focus explicitly so keyboard scrubbing works after click.
    slider.focus({ preventScroll: true });
    apply(fromEvent(e.clientX));
    e.preventDefault();
  });
  on(slider, "pointermove", (e) => {
    if (dragging) apply(fromEvent(e.clientX));
  });
  const up = () => {
    dragging = false;
  };
  slider.addEventListener("pointerup", up);
  slider.addEventListener("pointercancel", up);
  cleanups.push(() => {
    slider.removeEventListener("pointerup", up);
    slider.removeEventListener("pointercancel", up);
  });

  // park the thumb on the current stop and sync all derived state
  apply(value);

  // keep the thumb parked on the correct stop if the layout reflows
  const ro = new ResizeObserver(() => apply(value));
  ro.observe(slider);
  cleanups.push(() => ro.disconnect());

  return () => {
    cleanups.forEach((f) => f());
    cards.forEach((li) => li.querySelector("[data-runs-detail]")?.remove());
  };
}
