import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export function mountScrollMotion(root: HTMLElement, route: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  gsap.registerPlugin(ScrollTrigger);
  const ctx = gsap.context(() => {
    const all = (q: string) => Array.from(root.querySelectorAll(q));
    if (route === "home") {
      gsap.from(all(".teaser"), {
        y: 24,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 0.9,
        ease: "expo.out",
        scrollTrigger: {
          trigger: root.querySelector(".teasers"),
          start: "top 80%",
          once: true,
        },
      });
    }
    if (route === "bench") {
      gsap.from(all(".bench-hero > *"), {
        y: 40,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: "expo.out",
      });
      all(".bench-rise").forEach((e) =>
        gsap.from(e, {
          y: 50,
          opacity: 0,
          duration: 0.9,
          ease: "expo.out",
          scrollTrigger: { trigger: e, start: "top 82%", once: true },
        }),
      );
      gsap.from(all(".dot"), {
        y: -80,
        opacity: 0,
        duration: 1,
        ease: "back.out(1.6)",
        stagger: 0.1,
        scrollTrigger: {
          trigger: root.querySelector("#scatter"),
          start: "top 75%",
          once: true,
        },
      });
      gsap.from(all(".shelf-seg"), {
        scaleY: 0,
        transformOrigin: "50% 100%",
        stagger: 0.04,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: root.querySelector("#catalog"),
          start: "top 80%",
          once: true,
        },
      });
    }
    if (route === "why") {
      const cards = all(".why-card");
      const stage = root.querySelector(".why-stage") as HTMLElement;
      const wrap = root.querySelector(".why-pin-wrap");
      if (stage && wrap) {
        gsap.set(cards, {
          yPercent: (i) => (i ? 16 : 0),
          autoAlpha: (i) => (i ? 0 : 1),
        });
        gsap.set(all(".face-back"), { autoAlpha: 0 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrap,
            start: "top top",
            end: () => "+=" + innerHeight * 4.2,
            scrub: 0.6,
            pin: stage,
            pinReparent: true,
            anticipatePin: 1,
          },
        });
        cards.forEach((card, i) => {
          const at = i * 1.45;
          if (i) {
            tl.to(
              cards[i - 1],
              {
                yPercent: -16,
                autoAlpha: 0,
                duration: 0.25,
                ease: "power1.in",
              },
              at,
            );
            tl.to(
              card,
              { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
              at + 0.2,
            );
          }
          tl.to(
            card.querySelector(".face-front"),
            { autoAlpha: 0, duration: 0.3, ease: "power1.inOut" },
            at + 0.75,
          );
          tl.to(
            card.querySelector(".face-back"),
            { autoAlpha: 1, duration: 0.3, ease: "power1.inOut" },
            at + 0.85,
          );
        });
      }
      all(".why-chapter").forEach((e) =>
        gsap.fromTo(
          e.querySelectorAll(".why-text > *"),
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: { trigger: e, start: "top 70%", once: true },
          },
        ),
      );
      gsap.from(all(".path-diagram .pd-node"), {
        scale: 0,
        transformOrigin: "50% 50%",
        stagger: 0.2,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: root.querySelector(".path-diagram"),
          start: "top 75%",
          end: "bottom 45%",
          scrub: 0.6,
        },
      });
      all(".path-diagram .pd-edge").forEach((e) => {
        const p = e as SVGGeometryElement;
        try {
          const l = p.getTotalLength();
          gsap.fromTo(
            p,
            { strokeDasharray: l, strokeDashoffset: l },
            {
              strokeDashoffset: 0,
              ease: "none",
              scrollTrigger: {
                trigger: root.querySelector(".path-diagram"),
                start: "top 75%",
                end: "bottom 45%",
                scrub: 0.6,
              },
            },
          );
        } catch {}
      });
    }
  }, root);
  return () => ctx.revert();
}
