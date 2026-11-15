import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
/** Authored sticker sorting story, reconstructed from rendered/source observations. */
export function mountHomeDemo(root: HTMLElement) {
  const demo = root.querySelector("#demo") as HTMLElement;
  if (!demo || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return () => {};
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
  const ctx = gsap.context(() => {
    const all = (q: string) =>
      Array.from(demo.querySelectorAll(q)) as HTMLElement[];
    const stickers = all(".hero-st"),
      ends = all(".hero-end"),
      slots = all(".hero-slot"),
      cmd = all(".hero-cmd");
    const selected = slots
      .map((n) => stickers.find((s) => s.dataset.id === n.dataset.id))
      .filter(Boolean) as HTMLElement[];
    const others = stickers.filter((n) => !selected.includes(n));
    const stage = stickers[0]?.parentElement as HTMLElement;
    if (!stage) return;
    const w = stage.clientWidth,
      h = stage.clientHeight;
    const positions = stickers.map((_, i) => ({
      x: w * (0.02 + (0.92 * i) / stickers.length),
      y: h - 65 - 100 * Math.sin(i * 1.8) ** 2,
    }));
    gsap.set(stickers, {
      x: (i) => positions[i].x,
      y: -160,
      rotation: (i) => ((i * 31) % 80) - 40,
      autoAlpha: 1,
    });
    gsap.set([...ends, ...cmd, ...slots], { autoAlpha: 0, y: 30 });
    gsap.set(all(".hero-mascot,.hero-postit,.hero-stamp"), { autoAlpha: 0 });
    const paths = Array.from(
      demo.querySelectorAll(".hero-trail"),
    ) as SVGPathElement[];
    const points = selected.map((_, i) => ({
      x: w * (0.2 + 0.32 * i),
      y: h * 0.58,
    }));
    const d =
      points.length > 1
        ? `M ${points[0].x} ${points[0].y} C ${w * 0.35} ${h * 0.36},${w * 0.35} ${h * 0.75},${points[1].x} ${points[1].y}`
        : "";
    paths.forEach((p) => {
      p.setAttribute("d", d);
      const l = p.getTotalLength();
      gsap.set(p, { strokeDasharray: l, strokeDashoffset: l });
    });
    const tl = gsap.timeline({ paused: true });
    tl.to(
      stickers,
      {
        y: (i) => positions[i].y,
        duration: 1.3,
        ease: "bounce.out",
        stagger: 0.018,
      },
      0,
    );
    tl.from(
      demo.querySelector("h2"),
      { y: 40, opacity: 0, duration: 1, ease: "expo.out" },
      1.2,
    );
    tl.to(cmd, { autoAlpha: 1, y: 0, duration: 0.8, ease: "expo.out" }, 3.4);
    others.forEach((node, i) =>
      tl.to(
        node,
        {
          x: positions[stickers.indexOf(node)].x + (i % 2 ? 700 : -700),
          y: -240,
          rotation: ((i * 37) % 240) - 120,
          rotationX: 140,
          autoAlpha: 0,
          duration: 1.7,
          ease: "power1.in",
        },
        5.4 + (Math.abs(positions[stickers.indexOf(node)].x - w / 2) / w) * 1.2,
      ),
    );
    selected.forEach((node, i) =>
      tl.to(
        node,
        {
          x: points[i].x - 80,
          y: points[i].y - 20,
          rotation: 0,
          scale: 1.12,
          duration: 1.1,
          ease: "power3.inOut",
        },
        6.9 + i * 0.08,
      ),
    );
    paths.forEach((p) =>
      tl.to(
        p,
        { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut" },
        8.2,
      ),
    );
    const mascot = demo.querySelector(".hero-mascot");
    if (mascot && paths[1]) {
      tl.set(mascot, { autoAlpha: 1 }, 8.2);
      tl.to(
        mascot,
        {
          motionPath: {
            path: paths[1],
            align: paths[1],
            alignOrigin: [0.5, 0.85],
          },
          duration: 2.4,
          ease: "power2.inOut",
        },
        8.2,
      );
    }
    tl.to([mascot, ...paths], { autoAlpha: 0, duration: 0.4 }, 12.6);
    tl.to(
      ends[0],
      { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out" },
      12.6,
    );
    selected.forEach((node, i) => {
      tl.call(
        () => {
          const a = node.getBoundingClientRect(),
            b = slots[i].getBoundingClientRect();
          gsap.to(node, {
            x: "+=" + (b.left - a.left),
            y: "+=" + (b.top - a.top),
            scale: 1,
            rotation: 0,
            duration: 0.9,
            ease: "power3.inOut",
            onComplete: () => {
              gsap.set(slots[i], { autoAlpha: 1, y: 0 });
              gsap.set(node, { autoAlpha: 0 });
            },
          });
        },
        [],
        12.95 + i * 0.06,
      );
    });
    tl.to(
      ends[1],
      { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out" },
      14.6,
    );
    const tokenNode = ends[1]?.querySelector(".font-display");
    const counter = { value: 110238 };
    tl.to(
      counter,
      {
        value: 304,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
          if (tokenNode)
            tokenNode.textContent = Math.round(counter.value).toLocaleString();
        },
      },
      14.9,
    );
    tl.fromTo(
      all(".hero-jar-fill"),
      { scaleX: 1 },
      { scaleX: 0.012, duration: 2, ease: "power2.inOut" },
      14.9,
    );
    tl.to(
      ends.slice(2),
      { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "expo.out" },
      16.6,
    );
    tl.fromTo(
      all(".hero-bag > *"),
      { y: -60, rotation: (i) => ((i * 31) % 100) - 50, autoAlpha: 0 },
      {
        y: 0,
        rotation: (i) => [-6, 5, -3, 7, -5][i % 5],
        autoAlpha: 1,
        duration: 0.8,
        ease: "bounce.out",
        stagger: 0.06,
      },
      16.8,
    );
    tl.to(
      all(".hero-stamp"),
      {
        autoAlpha: 1,
        scale: 1,
        rotation: -8,
        duration: 0.45,
        ease: "back.out(2.2)",
      },
      18.1,
    );
    tl.timeScale(1.8);
    ScrollTrigger.create({
      trigger: demo,
      start: "top 40%",
      once: true,
      onEnter: () => tl.play(0),
    });
  }, demo);
  return () => ctx.revert();
}
