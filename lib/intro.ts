import gsap from "gsap";
/** Finite, component-only landing assembly. No graph prelude. */
export function playIntro(hero: HTMLElement, _markup: string): () => void {
  // Wait for the real font/photo gate before measuring or assembling the hero.
  if (document.documentElement.hasAttribute("data-visual")) {
    let dispose: (() => void) | undefined;
    const observer = new MutationObserver(() => {
      if (!document.documentElement.hasAttribute("data-visual")) {
        observer.disconnect();
        dispose = playIntro(hero, _markup);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-visual"] });
    return () => { observer.disconnect(); dispose?.(); };
  }
  if (
    sessionStorage.getItem("sb-intro-seen") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return () => {};
  const content = hero.querySelector(":scope > div.relative") as HTMLElement;
  if (!content) return () => {};
  const blocks = Array.from(
    content.querySelectorAll("[data-swarm-block=type] > *, .poster-cards"),
  ).filter(
    (n) => n instanceof HTMLElement && !n.classList.contains("sr-only"),
  ) as HTMLElement[];
  const targets = blocks.length ? blocks : [content];
  const layer = document.createElement("div");
  layer.className = "assembly-agents";
  layer.setAttribute("aria-hidden", "true");
  hero.append(layer);
  const names = ["type", "layout", "cards", "copy"];
  const colors = ["#cfef39", "#ffaccc", "#88cbdd", "#ffe474"];
  const agents = names.map((name, i) => {
    const cursor = document.createElement("div");
    cursor.className = "assembly-cursor";
    cursor.innerHTML = `<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2L3 22L9 16L14 25L18 23L13 14L21 13Z" fill="${colors[i]}" stroke="#1f2a1c" stroke-width="1.5"/></svg><span style="background:${colors[i]}">${name}</span>`;
    layer.append(cursor);
    return cursor;
  });
  const skip = document.createElement("button");
  skip.className = "assembly-skip";
  skip.textContent = "Skip intro";
  hero.append(skip);
  const savedText = new Map<HTMLElement, string>();
  let finished = false;
  const clear = () => {
    savedText.forEach((value, node) => {
      node.textContent = value;
    });
    targets.forEach((target) =>
      gsap.set(target, {
        clearProps: "transform,opacity,visibility,filter,clipPath,minHeight",
      }),
    );
    hero
      .querySelectorAll(".pb-ch")
      .forEach((n) => gsap.set(n, { visibility: "visible" }));
    layer.remove();
    skip.remove();
    document.documentElement.removeAttribute("data-assembly");
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timeline.kill();
    clear();
    sessionStorage.setItem("sb-intro-seen", "1");
  };
  const base = hero.getBoundingClientRect();
  const bounds = targets.map((node) => node.getBoundingClientRect());
  gsap.set(targets, { autoAlpha: 0 });
  document.documentElement.removeAttribute("data-assembly");
  gsap.set(agents, { opacity: 0 });
  const timeline = gsap.timeline({ onComplete: finish });
  const selections: HTMLElement[] = [];
  const characters: HTMLElement[] = [];
  targets.forEach((target, i) => {
    const agent = agents[i % agents.length];
    const rect = bounds[i];
    const x = rect.left - base.left,
      y = rect.top - base.top;
    const start = 0.1 + i * 1.05;
    const selection = document.createElement("div");
    selection.className = "assembly-selection";
    selection.style.cssText = `left:${x}px;top:${y}px;width:${rect.width}px;height:${rect.height}px`;
    selection.innerHTML =
      "<i></i><i></i><i></i><i></i><small>placing · " +
      names[i % names.length] +
      "</small>";
    layer.append(selection);
    selections.push(selection);
    gsap.set(selection, { visibility: "hidden" });
    timeline.fromTo(
      agent,
      { x: i % 2 ? base.width + 40 : -80, y: y + 65, opacity: 0 },
      { x: x + 8, y: y + 10, opacity: 1, duration: 0.5, ease: "power2.inOut" },
      start,
    );
    timeline.set(selection, { visibility: "visible" }, start + 0.48);
    const glyphs = Array.from(
      target.querySelectorAll(".pb-ch"),
    ) as HTMLElement[];
    if (glyphs.length) {
      characters.push(...glyphs);
      gsap.set(glyphs, { visibility: "hidden" });
      timeline.set(target, { autoAlpha: 1 }, start + 0.5);
      glyphs.forEach((glyph, k) => {
        const at = start + 0.5 + k * 0.05;
        timeline.set(glyph, { visibility: "visible" }, at);
        timeline.to(
          agent,
          {
            x: glyph.getBoundingClientRect().right - base.left,
            y: glyph.getBoundingClientRect().bottom - base.top,
            duration: 0.045,
            ease: "none",
          },
          at,
        );
      });
      timeline.set(selection, { visibility: "hidden" }, start + 1.85);
    } else if (target.tagName === "P") {
      const range = document.createRange();
      const original = target.textContent || "";
      savedText.set(target, original);
      const text = document.createTextNode("");
      target.replaceChildren(text);
      target.style.minHeight = rect.height + "px";
      timeline.set(target, { autoAlpha: 1 }, start + 0.5);
      const progress = { count: 0 };
      timeline.to(
        progress,
        {
          count: original.length,
          duration: 1.4,
          ease: "none",
          onUpdate: () => {
            text.textContent = original.slice(0, Math.round(progress.count));
            if (text.length) {
              range.setStart(text, Math.max(0, text.length - 1));
              range.setEnd(text, text.length);
              const r = range.getBoundingClientRect();
              gsap.set(agent, {
                x: r.right - base.left + 3,
                y: r.bottom - base.top,
              });
            }
          },
          onComplete: () => {
            target.style.minHeight = "";
          },
        },
        start + 0.5,
      );
      timeline.set(selection, { visibility: "hidden" }, start + 2);
    } else {
      timeline.set(
        target,
        { autoAlpha: 1, clipPath: "inset(0 100% 100% 0)" },
        start + 0.5,
      );
      timeline.to(
        target,
        { clipPath: "inset(0 0% 0% 0)", duration: 0.8, ease: "power2.inOut" },
        start + 0.5,
      );
      timeline.fromTo(
        selection,
        { width: 1, height: 1 },
        {
          width: rect.width,
          height: rect.height,
          duration: 0.8,
          ease: "power2.inOut",
        },
        start + 0.5,
      );
      timeline.to(
        agent,
        {
          x: x + rect.width,
          y: y + rect.height,
          duration: 0.8,
          ease: "power2.inOut",
        },
        start + 0.5,
      );
      timeline.to(
        [target, selection],
        { x: -8, y: -4, duration: 0.15 },
        start + 1.35,
      );
      timeline.to(
        [target, selection],
        { x: 0, y: 0, duration: 0.2 },
        start + 1.5,
      );
      timeline.set(selection, { visibility: "hidden" }, start + 1.75);
    }
  });
  const end = 0.1 + (targets.length - 1) * 1.05 + 2.1;
  timeline.to(
    agents,
    {
      x: (i) => (i % 2 ? base.width + 70 : -100),
      y: "+=100",
      opacity: 0,
      duration: 0.65,
      stagger: 0.06,
      ease: "power2.in",
    },
    end,
  );
  skip.onclick = finish;
  return () => {
    timeline.kill();
    clear();
  };
}
