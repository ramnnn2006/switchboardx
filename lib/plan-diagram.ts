import type { plan } from "./planner";
/** Accessible SVG plan diagram with pan and zoom. */
export function drawPlan(
  host: HTMLElement,
  result: ReturnType<typeof plan>,
  whole = false,
) {
  if (whole) {
    const frame = document.createElement("iframe");
    frame.src = "/explore?embed=1";
    frame.title = "Whole graph";
    frame.style.cssText = "width:100%;height:100%;border:0";
    host.append(frame);
    return;
  }
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 850 430");
  svg.setAttribute("aria-label", "Plan in call order");
  svg.setAttribute("role", "img");
  const group = document.createElementNS(ns, "g");
  svg.append(group);
  function element(
    tag: string,
    attrs: Record<string, string | number>,
    text?: string,
  ) {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    group.append(n);
    return n;
  }
  for (const [y, label] of [
    [160, "text.query"],
    [270, "session"],
  ] as const) {
    element("rect", {
      x: 30,
      y,
      width: 155,
      height: 38,
      rx: 8,
      fill: "#f6f1e4",
      stroke: "#9db08a",
    });
    element(
      "text",
      {
        x: 42,
        y: y + 24,
        "font-size": 12,
        fill: "#526e2d",
        "font-family": "Geist Mono,monospace",
      },
      "held · " + label,
    );
  }
  const steps = result.steps;
  steps.forEach((s, i) => {
    const x = 250 + (i % 2) * 300,
      y = 160 + Math.floor(i / 2) * 145;
    const path =
      i === 0
        ? `M185 288 C220 288 220 220 ${x} ${y + 26}`
        : `M${x - 70} ${y + 26} L${x} ${y + 26}`;
    element("path", {
      d: path,
      fill: "none",
      stroke: "#1f2a1c",
      "stroke-width": 9,
    });
    element("path", {
      d: path,
      fill: "none",
      stroke: result.guard === "blocked" ? "#ff5a36" : "#d9f94a",
      "stroke-width": 5,
    });
    element("rect", {
      x,
      y,
      width: 215,
      height: 58,
      rx: 25,
      fill: "#a4b98e",
      stroke: "#1f2a1c",
      "stroke-width": 3,
    });
    element("rect", {
      x: x + 5,
      y: y + 5,
      width: 205,
      height: 48,
      rx: 20,
      fill: "none",
      stroke: "#f6f1e4",
      "stroke-width": 3,
    });
    element("circle", { cx: x + 24, cy: y + 30, r: 10, fill: "#1f2a1c" });
    element(
      "text",
      { x: x + 21, y: y + 34, fill: "#f6f1e4", "font-size": 11 },
      String(i + 1),
    );
    element(
      "text",
      {
        x: x + 45,
        y: y + 21,
        fill: "#526e2d",
        "font-size": 10,
        "font-family": "monospace",
      },
      s.server,
    );
    element(
      "text",
      {
        x: x + 45,
        y: y + 39,
        fill: "#1f2a1c",
        "font-size": 12,
        "font-weight": 700,
        "font-family": "monospace",
      },
      s.label.length > 22 ? s.label.slice(0, 21) + "…" : s.label,
    );
  });
  if (result.guard === "blocked")
    element(
      "text",
      { x: 250, y: 390, "font-size": 20, fill: "#ff5a36", "font-weight": 700 },
      "BLOCKED · unsafe chain cut",
    );
  let scale = 1,
    x = 0,
    y = 0,
    drag = false,
    lastX = 0,
    lastY = 0;
  const update = () =>
    group.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      scale = Math.max(0.4, Math.min(3, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      update();
    },
    { passive: false },
  );
  svg.addEventListener("pointerdown", (e) => {
    drag = true;
    lastX = e.clientX;
    lastY = e.clientY;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (drag) {
      x += e.clientX - lastX;
      y += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      update();
    }
  });
  svg.addEventListener("pointerup", () => (drag = false));
  host.append(svg);
}
