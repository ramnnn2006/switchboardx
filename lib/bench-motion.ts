import gsap from "gsap";
import { bindStickerDrag } from "./sticker-drag";
/**
 * Bench kill-demo motion: peel-to-arm sticker, armed ring, simulated
 * kill/recovery feedback. Mounted by Experience (route === "bench").
 * Original evidence (switchhboard.vercel.app/bench, 2026-11-16):
 *  - drag peels the DO NOT PEEL sticker off; button stays "KILL THE DB"
 *    and gains a red armed ring (never an "ARMED" text overwrite);
 *  - click drops a dotted "killed" annotation on the latency chart and
 *    appends a "killed  HH:MM:SS" log row at the card bottom.
 * The kill/recovery itself stays a local simulation.
 */
export function mountBenchMotion(root: HTMLElement) {
  const disposers: Array<() => void> = [];
  const kill = Array.from(root.querySelectorAll("main button")).find((b) =>
    b.getAttribute("aria-label")?.startsWith("Kill the DB"),
  ) as HTMLButtonElement | undefined;
  const card = kill?.closest("div")?.parentElement ?? null;
  const warn = root.querySelector(".kd-warn") as HTMLElement | null;
  const status = root.querySelector(".kd-status") as HTMLElement | null;
  const stamp = root.querySelector(".kd-stamp") as HTMLElement | null;
  const log = card?.querySelector("ul") as HTMLUListElement | null;
  const chart = root.querySelector(
    'svg[aria-label="Live latency percentiles"]',
  ) as SVGSVGElement | null;
  if (kill) kill.removeAttribute("disabled");

  let armed = false;
  if (kill && warn) {
    disposers.push(
      bindStickerDrag(warn, (x, y) => {
        const r = warn.getBoundingClientRect();
        const peeled =
          x < r.left - 60 || x > r.right + 60 || y < r.top - 60 || y > r.bottom + 60;
        if (!peeled) return false;
        armed = true;
        kill.setAttribute("data-armed", "true");
        kill.setAttribute("aria-label", "Run the local kill-recovery simulation");
        gsap.to(warn, {
          autoAlpha: 0,
          scale: 0.85,
          duration: 0.25,
          onComplete: () => warn.remove(),
        });
        kill.style.boxShadow = "0 0 0 4px rgba(212,69,43,.9)";
        return true;
      }),
    );
  }
  if (kill) {
    const onKill = () => {
      if (!armed) return;
      armed = false;
      kill.style.boxShadow = "";
      if (status) status.textContent = "RECOVERING…";
      if (chart && !chart.querySelector("[data-kill-mark]")) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", "90");
        line.setAttribute("y1", "18");
        line.setAttribute("x2", "90");
        line.setAttribute("y2", "202");
        line.setAttribute("stroke", "#C0392B");
        line.setAttribute("stroke-dasharray", "3 4");
        line.setAttribute("data-kill-mark", "");
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", "98");
        label.setAttribute("y", "30");
        label.setAttribute("fill", "#C0392B");
        label.setAttribute("font-size", "11");
        label.setAttribute("data-kill-mark", "");
        label.textContent = "killed";
        chart.append(line, label);
      }
      if (log) {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between font-mono text-[12px] text-ink/60";
        const t = new Date();
        const hh = String(t.getHours()).padStart(2, "0");
        const mm = String(t.getMinutes()).padStart(2, "0");
        const ss = String(t.getSeconds()).padStart(2, "0");
        li.innerHTML = `<span>killed</span><span class="tabular-nums">${hh}:${mm}:${ss}</span>`;
        log.prepend(li);
      }
      window.setTimeout(() => {
        if (status) status.textContent = "ALIVE · recovered in 3.3s";
        if (stamp) gsap.to(stamp, { autoAlpha: 1, duration: 0.3 });
      }, 3300);
    };
    kill.addEventListener("click", onKill);
    disposers.push(() => kill.removeEventListener("click", onKill));
  }
  return () => disposers.forEach((d) => d());
}
