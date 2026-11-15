import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export function mountScrollMotion(root: HTMLElement, route: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.querySelectorAll<HTMLElement>(".shelf-seg").forEach(e=>{e.style.transform="none";e.style.opacity="1";});
    root.querySelectorAll(".pd-node").forEach(e=>e.removeAttribute("transform"));
    return ()=>{};
  }
  gsap.registerPlugin(ScrollTrigger);
  const disposers: Array<() => void> = [];
  const ctx = gsap.context(() => {
    const all = (q: string) => Array.from(root.querySelectorAll(q));
    // Global chrome driven by scroll (original evidence, switchhboard.vercel.app):
    // - header progress bar (header .bg-lime, origin-left): scaleX = scrollY / (docHeight - viewport)
    //   Measured original: desktop 0.2756@2000, 0.3585@2600, 0.4137@3000 (docH 8239, vp 988);
    //   mobile 0.1483@900, 0.2143@1300, 0.2637@1600 (docH 6911, vp 844).
    // - back-to-top: hidden in markup (opacity-0); original reveals it at ~1.5x viewport
    //   (desktop visible @2000 with vp 988; mobile visible @1300, hidden @900 with vp 844).
    const progressBar = root.querySelector(
      "header div.origin-left.bg-lime",
    ) as HTMLElement | null;
    const toTop = root.querySelector(
      'button[aria-label="Back to top"]',
    ) as HTMLButtonElement | null;
    if (progressBar || toTop) {
      const applyChrome = () => {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        if (progressBar) {
          const p = maxScroll > 0 ? window.scrollY / maxScroll : 0;
          progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
        }
        if (toTop) {
          const show = window.scrollY >= window.innerHeight * 1.5;
          toTop.classList.toggle("opacity-0", !show);
          toTop.classList.toggle("translate-y-3", !show);
          toTop.classList.toggle("pointer-events-none", !show);
          toTop.setAttribute("aria-hidden", String(!show));
          toTop.tabIndex = show ? 0 : -1;
        }
      };
      applyChrome();
      window.addEventListener("scroll", applyChrome, { passive: true });
      window.addEventListener("resize", applyChrome);
      disposers.push(() => {
        window.removeEventListener("scroll", applyChrome);
        window.removeEventListener("resize", applyChrome);
      });
    }
    if (toTop) {
      const onTopClick = () =>
        window.scrollTo({ top: 0, behavior: "smooth" });
      toTop.addEventListener("click", onTopClick);
      disposers.push(() => toTop.removeEventListener("click", onTopClick));
    }
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
      gsap.fromTo(
        all(".shelf-seg"),
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "50% 100%",
        stagger: 0.04,
        duration: 0.8,
        ease: "power3.out",
          scrollTrigger: {
            trigger: root.querySelector("#catalog"),
            start: "top 80%",
            once: true,
          },
        },
      );
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
        const dashes = all(".why-pin-wrap div.absolute.bottom-10 > span");
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrap,
            start: "top top",
            end: () => "+=" + innerHeight * 4.2,
            scrub: 0.6,
            pin: stage,
            pinReparent: true,
            anticipatePin: 1,
            onUpdate: (self) => {
              // 4-dash chapter indicator advances with pin progress (1 of 4 per chapter).
              const idx = Math.min(
                dashes.length - 1,
                Math.floor(self.progress * dashes.length),
              );
              dashes.forEach((d, j) => {
                const on = j === idx;
                d.classList.toggle("w-8", on);
                d.classList.toggle("bg-ink", on);
                d.classList.toggle("w-3", !on);
                d.classList.toggle("bg-ink/20", !on);
              });
            },
          },
        });
        cards.forEach((card, i) => {
          const at = i * 1.45;
          if (i) {
            // Original: the No-order card leaves before the final chapter's
            // text settles, so that chapter starts with no card on stage.
            const exitAt = i === cards.length - 1 ? at - 0.45 : at;
            tl.to(
              cards[i - 1],
              {
                yPercent: -16,
                autoAlpha: 0,
                duration: 0.25,
                ease: "power1.in",
              },
              exitAt,
            );
            tl.to(
              card,
              { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" },
              at + 0.2,
            );
          }
          // Card 2 (No-order) has no meaningful back face in the original:
          // it never flips, it simply exits.
          if (i === 2) return;
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
      // Left chapter rail: advance aria-current/tick/label with the section in view.
      const railLinks = all('nav[aria-label="On this page"] a[href^="#"]');
      const setRail = (id: string) => {
        railLinks.forEach((a) => {
          const active = a.getAttribute("href") === "#" + id;
          const spans = a.querySelectorAll("span");
          const tick = spans[0];
          const label = spans[1];
          if (active) {
            a.setAttribute("aria-current", "true");
            tick?.classList.remove("scale-x-50", "bg-ink/35");
            tick?.classList.add("bg-ink");
            label?.classList.add("min-[1800px]:opacity-100");
          } else {
            a.removeAttribute("aria-current");
            tick?.classList.add("scale-x-50", "bg-ink/35");
            tick?.classList.remove("bg-ink");
            label?.classList.remove("min-[1800px]:opacity-100");
          }
        });
      };
      railLinks.forEach((a) => {
        const id = (a.getAttribute("href") || "").slice(1);
        const sec = id ? root.querySelector("#" + CSS.escape(id)) : null;
        if (!sec) return;
        ScrollTrigger.create({
          trigger: sec,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => {
            if (self.isActive) setRail(id);
          },
        });
      });
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
      gsap.fromTo(
        all(".path-diagram .pd-node"),
        { scale: 0 },
        {
          scale: 1,
          transformOrigin: "50% 50%",
          stagger: 0.2,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: root.querySelector(".path-diagram"),
            start: "top 75%",
            end: "bottom 45%",
            scrub: 0.6,
          },
        },
      );
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
  return () => {
    disposers.forEach((d) => d());
    ctx.revert();
  };
}
