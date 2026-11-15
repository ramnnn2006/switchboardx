import gsap from "gsap";
export function animateGuard(root: HTMLElement, blocked: boolean) {
  const svg = root.querySelector(
    'svg[aria-label^="Chain"]',
  ) as SVGSVGElement | null;
  if (!svg) return;
  svg.querySelectorAll("[data-guard-motion]").forEach((n) => n.remove());
  const ns = "http://www.w3.org/2000/svg";
  const ring = document.createElementNS(ns, "circle");
  ring.dataset.guardMotion = "true";
  for (const [k, v] of Object.entries({
    cx: "130",
    cy: "200",
    r: "18",
    fill: "#D9F94A",
    stroke: "#1F2A1C",
    "stroke-width": "4",
  }))
    ring.setAttribute(k, v);
  svg.append(ring);
  const wrapper = svg.parentElement!;
  const message = wrapper.querySelector("p")!;
  const badge = wrapper.querySelector(".absolute.right-4") as HTMLElement;
  const nodes = Array.from(svg.querySelectorAll(".g-node"));
  const edges = svg.querySelectorAll(".g-edge");
  const cards = Array.from(
    root.querySelectorAll("main div.rounded-xl, main div.rounded-lg"),
  ).filter(
    (n) =>
      /^Private data|^Untrusted input|^Sends out/.test(
        n.textContent?.trim() || "",
      ) && n.children.length < 5,
  );
  const timeline = gsap.timeline();
  timeline
    .call(() => {
      message.textContent = "The agent is reading the page.";
      badge.textContent = "";
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
          (n as HTMLElement).style.background = [
            "#FFC8DD",
            "#FFE66D",
            "#FF5A36",
          ][i];
          (n as HTMLElement).style.color = "#1f2a1c";
        });
      },
      [],
      1.25,
    )
    .to(
      ring,
      {
        attr: { cx: blocked ? 505 : 630 },
        duration: 0.7,
        ease: "power2.inOut",
      },
      1.8,
    )
    .call(
      () => {
        ring.style.display = "none";
        const edge = edges[1];
        if (edge) {
          edge.setAttribute("stroke", blocked ? "#FF5A36" : "#D9F94A");
          edge.setAttribute("stroke-dasharray", blocked ? "2 10" : "none");
        }
        if (badge) {
          badge.textContent = blocked ? "BLOCKED" : "ALLOWED";
          badge.style.cssText =
            "position:absolute;right:20px;top:16px;transform:rotate(-7deg);border:2px solid currentColor;border-radius:4px;padding:4px 9px;font:bold 17px Geist Mono,monospace;color:" +
            (blocked ? "#FF5A36" : "#4E6B3A");
        }
        message.textContent = blocked
          ? "Blocked before it runs. The agent can still summarize the page."
          : "Nothing to cut. This chain runs.";
        if (blocked) {
          const label = document.createElementNS(ns, "text");
          label.dataset.guardMotion = "true";
          label.setAttribute("x", "505");
          label.setAttribute("y", "207");
          label.setAttribute("fill", "#FF5A36");
          label.setAttribute("font-size", "30");
          label.textContent = "×";
          svg.append(label);
          const rect = document.createElementNS(ns, "rect");
          rect.dataset.guardMotion = "true";
          for (const [k, v] of Object.entries({
            x: "290",
            y: "295",
            width: "180",
            height: "48",
            rx: "10",
            fill: "#D9F94A",
            stroke: "#1F2A1C",
            "stroke-width": "2",
          }))
            rect.setAttribute(k, v);
          svg.append(rect);
          const safe = document.createElementNS(ns, "text");
          safe.dataset.guardMotion = "true";
          safe.setAttribute("x", "380");
          safe.setAttribute("y", "324");
          safe.setAttribute("text-anchor", "middle");
          safe.setAttribute("font-size", "12");
          safe.setAttribute("font-weight", "700");
          safe.textContent = "Summarize, nothing else";
          svg.append(safe);
          gsap.from([rect, safe], { opacity: 0, y: -8, duration: 0.5 });
        } else gsap.to(nodes[2], { opacity: 1, duration: 0.3 });
      },
      [],
      2.5,
    );
  return timeline;
}
