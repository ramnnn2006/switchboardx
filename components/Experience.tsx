"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Planner from "./Planner";
import galaxy from "../data/galaxy.json";
import introMarkup from "../data/intro-markup.json";
import { playIntro } from "../lib/intro";
import { startTour } from "../lib/tour";
import { mountGalaxy, type GalaxyFilter } from "../lib/galaxy";
import { animateGuard, resetGuard } from "../lib/guard-motion";
import { mountHomeDemo } from "../lib/home-demo";
import { mountBenchMotion } from "../lib/bench-motion";
import { mountScrollMotion } from "../lib/scroll-motion";
import docClientConfigs from "../data/doc-client-configs.json";
import controlSnapshots from "../data/control-snapshots.json";
import guardScenarios from "../data/guard-scenarios.json";
type Node = (typeof galaxy.nodes)[number];
const routes = ["Ask", "Explore", "Why", "Bench", "Guard", "Runs", "Docs"];
const tourSteps = [
  [
    "Stop loading every tool.",
    "Switchboard picks the few tools a task needs, in the order it calls them.",
  ],
  [
    "One task. Only its tools.",
    "Open Ask, choose a task, then inspect the steps, tokens and guard verdict.",
  ],
  [
    "Bring what you know.",
    "Drag the value stickers into Already known. Drop a tool on Exclude to replan without it.",
  ],
  [
    "All 420 tools, one graph.",
    "Explore the catalog. Click a server, search for a tool, filter risk flags, and zoom into a node.",
  ],
  [
    "The chain matters.",
    "Guard checks for private data, untrusted input and a way out. Three safe tools can make an unsafe chain.",
  ],
  [
    "Bring your own agent.",
    "Docs explains the MCP connection. This rebuild runs locally. Original account and HydraDB services are not connected.",
  ],
];
export default function Experience({
  route,
  html,
}: {
  route: string;
  html: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [tourInvite, setTourInvite] = useState(false);
  const [menu, setMenu] = useState(false),
    [cmd, setCmd] = useState(false),
    [q, setQ] = useState(""),
    [tour, setTour] = useState(-1),
    [toast, setToast] = useState(""),
    [task, setTask] = useState(""),
    [slot, setSlot] = useState<HTMLElement | null>(null),
    [budget, setBudget] = useState(4000),
    [node, setNode] = useState<Node | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(t: string) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }
  useEffect(() => {
    if (!root.current) return;
    const el = root.current;
    let cleanup: (() => void)[] = [];
    if(route === "explore" && new URLSearchParams(location.search).get("embed") === "1") {
      el.innerHTML = '<div aria-label="Whole catalog graph with current path highlighted" style="position:fixed;inset:0;background:#1f2a1c"></div>';
      let disposed=false;let destroy:(()=>void)|undefined;
      mountGalaxy(el.firstElementChild as HTMLElement,()=>{}).then(c=>{ if(disposed){c.destroy();return;}destroy=()=>c.destroy();c.setFilter({path:(new URLSearchParams(location.search).get("path")||"").split(",").filter(Boolean)}); });
      return ()=>{disposed=true;destroy?.();};
    }
    const stored = localStorage.getItem("sb-theme");
    if (stored) {
      document.documentElement.classList.toggle("dark", stored === "dark");
      document.documentElement.classList.toggle("light", stored !== "dark");
      document.documentElement.style.colorScheme = stored;
    }
    // Never replay unknown remote JavaScript. All behavior below is authored locally.
    const on = (n: Element | null, event: string, f: EventListener) => {
      if (n) {
        n.addEventListener(event, f);
        cleanup.push(() => n.removeEventListener(event, f));
      }
    };
    const all = (s: string) => Array.from(el.querySelectorAll(s));
    const text = (n: Element) => n.textContent?.trim() || "";
    const copyText = async (value: string, success = "Copied") => {
      try { await navigator.clipboard.writeText(value); notify(success); }
      catch {
        const field=document.createElement("textarea"); field.value=value;
        field.style.cssText="position:fixed;left:-9999px;top:0"; document.body.append(field); field.select();
        const copied=document.execCommand("copy");field.remove();
        notify(copied?success:"Copy unavailable in this browser. Select the code to copy it.");
      }
    };
    all("button").forEach((b) => {
      if (b.getAttribute("aria-label") === "Open menu") on(b, "click", () => setMenu(x => !x));
      if (b.getAttribute("aria-label")?.includes("mode"))
        on(b, "click", () => {
          const dark = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", dark);
          document.documentElement.classList.toggle("light", !dark);
          document.documentElement.style.colorScheme = dark ? "dark" : "light";
          localStorage.setItem("sb-theme", dark ? "dark" : "light");
          b.setAttribute(
            "aria-label",
            dark ? "Switch to light mode" : "Switch to dark mode",
          );
        });
      if (
        b.getAttribute("aria-label")?.includes("Search or") ||
        /Search the docs/.test(text(b))
      )
        on(b, "click", () => setCmd(true));
      if (
        b.getAttribute("aria-label") === "Take the tour" ||
        text(b) === "Take the tour"
      )
        on(b, "click", () => startTour());
      if (text(b) === "Copy link")
        on(b, "click", () => {
          void copyText(location.href,"Link copied");
        });
      if (text(b) === "copy")
        on(b, "click", () => {
          const code = b
            .closest("div")
            ?.parentElement?.querySelector("pre,code");
          void copyText(
            code?.querySelectorAll("code").length
              ? Array.from(code.querySelectorAll("code"))
                  .map((n) => n.textContent)
                  .join("\n")
              : code?.textContent || "",
          );
        });
      if (text(b) === "Copy prompt")
        on(b, "click", () => {
          void copyText(
            "Switchhboard-mcp npm publication is pending. Once switchhboard-mcp is published, add the stdio MCP server using command npx and args [-y, switchhboard-mcp]. It exposes plan, report_run and catalog_stats. The current local build plans in process; the requested HydraDB backend is still being implemented and is not verified yet. Do not install similarly named packages.",
            "Agent connection prompt copied",
          );
        });
    });
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((x) => !x);
      }
      if (e.key === "Escape") {
        setCmd(false);
        setMenu(false);
        setTour(-1);
        setNode(null);
      }
    };
    document.addEventListener("keydown", key);
    cleanup.push(() => document.removeEventListener("keydown", key));
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if(route !== "bench") gsap.fromTo(
          el.querySelectorAll(
            "main > div > header h1,main > div > section:first-child h1",
          ),
          { y: 12, opacity: 0.65 },
          { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
        );
        el.querySelectorAll("main section:not(:first-child) h2").forEach((n) =>
          gsap.fromTo(
            n,
            { y: 15 },
            {
              y: 0,
              duration: 0.6,
              scrollTrigger: { trigger: n, start: "top 93%", once: true },
            },
          ),
        );
      }
    }, el);
    cleanup.push(() => ctx.revert());
    cleanup.push(mountScrollMotion(el, route));
    let activePage = true;
    document.fonts.ready.then(() => { if(activePage) ScrollTrigger.refresh(); });
    el.querySelectorAll("img").forEach(img => { if(!img.complete) on(img,"load",()=>ScrollTrigger.refresh()); });
    cleanup.push(()=>{activePage=false;});
    // Finite landing component assembly, followed by original scroll parallax.
    if (route === "home") {
      const invite = () => { if(!localStorage.getItem("sb-tour-dismissed")) setTourInvite(true); };
      window.addEventListener("sb-intro-finished", invite);
      cleanup.push(() => window.removeEventListener("sb-intro-finished", invite));
      if(sessionStorage.getItem("sb-intro-seen") || matchMedia("(prefers-reduced-motion: reduce)").matches) { const timer = setTimeout(invite,1500); cleanup.push(()=>clearTimeout(timer)); }
      cleanup.push(mountHomeDemo(el));
      const hero = el.querySelector("main > section") as HTMLElement;
      if (hero) {
        cleanup.push(playIntro(hero, introMarkup));
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const scroll = gsap.context(() => {
            const trigger = {
              trigger: hero,
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            };
            gsap.to(hero.querySelector(".poster-photo-inner"), {
              yPercent: 8,
              ease: "none",
              scrollTrigger: trigger,
            });
            gsap.to(hero.querySelector(".poster-type"), {
              y: -40,
              autoAlpha: 0.2,
              ease: "none",
              scrollTrigger: trigger,
            });
          }, hero);
          cleanup.push(() => scroll.revert());
        }
      }
      const photo = el.querySelector(".poster-photo-inner");
      on(el, "pointermove", ((e: PointerEvent) => {
        if (photo && !matchMedia("(prefers-reduced-motion: reduce)").matches)
          gsap.to(photo, {
            x: -(e.clientX / innerWidth - 0.5) * 10,
            y: -(e.clientY / innerHeight - 0.5) * 6,
            duration: 1.2,
            ease: "power3.out",
          });
      }) as EventListener);
    }
    // Search form is the same on the landing page and the planner.
    all(
      'main form:has(input[aria-label="Describe a task for your agent"])',
    ).forEach((form) =>
      on(form, "submit", (e) => {
        e.preventDefault();
        const input = form.querySelector("input") as HTMLInputElement | null;
        if (!input?.value.trim()) return;
        if (route === "ask") {
          const ghost = input.nextElementSibling as HTMLElement;
          if (ghost) ghost.style.display = "none";
          setTask(input.value.trim());
          history.replaceState(
            null,
            "",
            "/ask?task=" + encodeURIComponent(input.value.trim()),
          );
        } else
          location.href = "/ask?task=" + encodeURIComponent(input.value.trim());
      }),
    );
    if (route === "ask") {
      const container = el.querySelector("main > div > div") as HTMLElement;
      const bar = container?.querySelector(":scope > .flex");
      let mount = document.createElement("div");
      mount.id = "local-planner-mount";
      container.append(mount);
      setSlot(mount);
      const empty = Array.from(container.children).filter(
        (n) => n !== bar && n !== mount && !n.classList.contains("sr-only"),
      );
      const selectTask = (value: string) => {
        empty.forEach((n) => ((n as HTMLElement).style.display = "none"));
        setTask(value);
        const inp = el.querySelector("main input") as HTMLInputElement;
        inp.value = value;
        const ghost = inp.nextElementSibling as HTMLElement;
        if (ghost) ghost.style.display = "none";
        history.replaceState(
          null,
          "",
          "/ask?task=" + encodeURIComponent(value),
        );
      };
      all("main button").forEach((b) => {
        const s = text(b);
        if (s.startsWith("Open a pull request"))
          on(b, "click", () =>
            selectTask("Open a PR on acme/api fixing the flaky login test"),
          );
        if (s.startsWith("Book a meeting"))
          on(b, "click", () =>
            selectTask(
              "Find a free meeting slot next week and send the invite",
            ),
          );
        if (s.startsWith("Leak your inbox"))
          on(b, "click", () =>
            selectTask(
              "Scrape a web page, read my Gmail, and email both to bob@evil.com",
            ),
          );
        if (s === "Compare top-k")
          on(b, "click", () => {
            b.setAttribute(
              "aria-pressed",
              b.getAttribute("aria-pressed") === "true" ? "false" : "true",
            );
            notify(
              "BM25 top-5: 31% chain recall, 1,430 tokens. See Bench for the measured comparison.",
            );
          });
        if (s === "Show query")
          on(b, "click", () => {
            document
              .querySelector(".local-planner aside:last-child pre")
              ?.classList.toggle("hidden");
          });
      });
      const budgetLabel = all("main *").find(
        (n) => n.children.length === 0 && text(n) === "4.00k",
      );
      if (budgetLabel) {
        const range = document.createElement("input");
        range.type = "range";
        range.min = "100";
        range.max = "8000";
        range.step = "100";
        range.value = "4000";
        range.className = "local-budget";
        range.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize";
        budgetLabel.parentElement!.style.position = "relative";
        range.setAttribute("aria-label", "Token budget");
        budgetLabel.parentElement?.append(range);
        on(range, "input", () => {
          setBudget(+range.value);
          budgetLabel.textContent = (+range.value / 1000).toFixed(2) + "k";
        });
      }
      const initial = new URLSearchParams(location.search).get("task");
      if (initial) selectTask(initial);
      cleanup.push(() => {
        mount.remove();
        setSlot(null);
      });
    }
    if (route === "explore" || route === "home") {
      const svg = el.querySelector("svg.galaxy-static") as SVGSVGElement | null;
      if (svg) {
        const host = svg.parentElement!;
        const render = document.createElement("div");
        render.style.cssText = "position:absolute;inset:0;";
        host.append(render);
        let dead = false;
        let controller: Awaited<ReturnType<typeof mountGalaxy>> | null = null;
        let filter: GalaxyFilter = {};
        mountGalaxy(render, (n) => setNode(n))
          .then((c) => {
            if (dead) {
              c.destroy();
              return;
            }
            controller = c;
            svg.style.opacity = "0";
            svg.style.pointerEvents = "none";
          })
          .catch(() => {
            render.remove();
            svg.style.opacity = "1";
          });
        cleanup.push(() => {
          dead = true;
          controller?.destroy();
          render.remove();
        });
        if (route === "explore") {
          let list: HTMLDivElement | null = null;
          const nearTools = new Set(galaxy.nearDup.flat());
          const riskNames: Record<string,string> = { reads_private: "reads private data", ingests_untrusted: "ingests untrusted content", exfil_sink: "can exfiltrate", destructive: "destructive" };
          const renderList = () => {
            if (!list) return;
            list.replaceChildren();
            const table = document.createElement("table");
            table.className = "catalog-table";
            table.innerHTML = '<caption class="sr-only">All tools in the catalog</caption><thead><tr><th>tool</th><th>server</th><th>consumes</th><th>yields</th><th>risk</th><th>degree</th></tr></thead>';
            const body = document.createElement("tbody");
            galaxy.nodes.filter(n => n.kind === "tool" && (!filter.server || n.server === filter.server) && (!filter.query || n.label.toLowerCase().includes(filter.query.toLowerCase())) && (!filter.risk || ("risk" in n && n.risk?.includes(filter.risk))) && (!filter.nearDup || nearTools.has(n.id))).forEach(n => {
              const row = document.createElement("tr");
              const name = document.createElement("td"), button = document.createElement("button");
              button.textContent = n.label;
              button.onclick = () => setNode(n);
              name.append(button); row.append(name);
              [n.server, "consumes" in n ? n.consumes?.join(", ") : "", "yields" in n ? n.yields?.join(", ") : ""].forEach(value => { const td = document.createElement("td"); td.textContent = value || ""; row.append(td); });
              const risk = document.createElement("td");
              if ("risk" in n) n.risk?.forEach(flag => { const icon = el.querySelector(`main svg[aria-label="${riskNames[flag]}"]`)?.cloneNode(true) as SVGSVGElement | undefined; if(icon) { icon.setAttribute("width","13"); icon.setAttribute("height","13"); risk.append(icon); } });
              row.append(risk);
              const degree = document.createElement("td"); degree.textContent = String(n.degree); row.append(degree); body.append(row);
            });
            table.append(body); list.append(table);
          };
          const apply = () => { controller?.setFilter({ ...filter }); renderList(); };
          const markActive = (b: Element, active: boolean) => { b.setAttribute("aria-pressed", String(active)); b.classList.toggle("catalog-filter-active", active); };
          all("main button").forEach((b) => {
            const s = text(b);
            const server = galaxy.servers.find(
              (x) => s === x.id + " " + x.tools,
            );
            if (server)
              on(b, "click", () => {
                filter.server = filter.server === server.id ? "" : server.id;
                filter.server
                  ? controller?.focusServer(filter.server)
                  : apply();
                apply();
                all("main button").filter(x => galaxy.servers.some(server => text(x) === server.id + " " + server.tools)).forEach(x => markActive(x, x === b && !!filter.server));
              });
            const flags: Record<string, string> = {
              "reads private data": "reads_private",
              "ingests untrusted content": "ingests_untrusted",
              "can exfiltrate": "exfil_sink",
              destructive: "destructive",
            };
            if (flags[s]) {
              b.setAttribute("aria-label", s);
              on(b, "click", () => {
                filter.risk = filter.risk === flags[s] ? "" : flags[s];
                apply();
                all("main button").filter(x => flags[text(x)]).forEach(x => markActive(x, x === b && !!filter.risk));
              });
            }
            if (s === "near-duplicates")
              on(b, "click", () => {
                filter.nearDup = !filter.nearDup;
                apply();
                markActive(b, !!filter.nearDup);
              });
            if (s === "Galaxy")
              on(b, "click", () => {
                filter = {};
                apply();
                controller?.sigma
                  .getCamera()
                  .animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 600 });
              });
            if (s === "list view")
              on(b, "click", () => {
                if (list) {
                  list.remove(); list = null;
                  render.style.visibility = "visible";
                  b.lastChild!.textContent = "list view";
                  b.setAttribute("aria-pressed", "false");
                  return;
                }
                render.style.visibility = "hidden";
                list = document.createElement("div");
                list.className = "local-tool-list";
                b.lastChild!.textContent = "galaxy";
                b.setAttribute("aria-pressed", "true");
                renderList();
                host.append(list);
              });
          });
          const search = el.querySelector("main input");
          on(search, "input", () => {
            filter.query = (search as HTMLInputElement).value;
            apply();
          });
        }
      }
    }
    if (route === "guard") {
      let preset = 0,
        running = false;
      const run = all("main button").find((b) => text(b) === "Run it");
      const scenarioNames = [
        "Inbox to email",
        "Files to Slack",
        "Database to public issue",
      ];
      all("main button").forEach((b) => {
        if (scenarioNames.includes(text(b)))
          on(b, "click", () => {
            resetGuard(el);
            preset = scenarioNames.indexOf(text(b));
            all("main button")
              .filter((x) => scenarioNames.includes(text(x)))
              .forEach((x) => { x.setAttribute("aria-pressed", String(x === b)); (x as HTMLElement).style.setProperty("background",x===b?"#1f2a1c":"transparent","important"); (x as HTMLElement).style.setProperty("color",x===b?"#f4f0e3":"#1f2a1c","important"); });
            const scenario = guardScenarios[preset];
            const area = el.querySelector("textarea")!;
            area.value = scenario.area;
            const svg = el.querySelector('svg[aria-label^="Chain"]');
            if (svg && scenario.svg) {
              const temp = document.createElement("div");
              temp.innerHTML = scenario.svg;
              svg.replaceWith(temp.firstElementChild!);
            }
            const rows = all("main table tbody tr");
            rows.forEach((row, i) => {
              const flags = scenario.flags.slice(i * 4, i * 4 + 4);
              const name = flags[0]?.aria.split(": ")[0];
              const label = row.querySelector("td");
              if (label && name) {
                label.textContent = name;
                label.title = name;
              }
              row.querySelectorAll("button").forEach((button, k) => {
                const flag = flags[k];
                if (!flag) return;
                button.setAttribute("aria-label", flag.aria);
                button.setAttribute("aria-pressed", flag.on || "false");
                button.style.background =
                  flag.on === "true" ? "#1f2a1c" : "transparent";
                button.style.opacity = flag.on === "true" ? "1" : ".35";
              });
            });
            const legCards = all(
              "main div.rounded-xl, main div.rounded-lg",
            ).filter(
              (n) =>
                /^(Private data|Untrusted input|Sends out)/.test(text(n)) &&
                n.children.length < 5,
            );
            const active = (label: string) =>
              scenario.flags
                .filter((f) => f.aria.endsWith(": " + label) && f.on === "true")
                .map((f) => f.aria.split(": ")[0].split(".").slice(1).join("."))
                .join(", ");
            legCards.forEach((card, i) => {
              const line = card.querySelector(".font-mono");
              if (line)
                line.textContent = active(
                  ["Private data", "Untrusted input", "Sends out"][i],
                );
            });
            running = false;
            if (run) run.textContent = "Run it";
            const chain = el.querySelector('svg[aria-label^="Chain"]');
            const wrap=chain?.parentElement;
            const message=wrap?.querySelector("p");
            if(message) message.textContent="Press run to watch an unguarded agent build this chain.";
            const badge=wrap?.querySelector(".absolute.right-4");
            if(badge) badge.textContent="";
            legCards.forEach(card => { (card as HTMLElement).style.background=""; (card as HTMLElement).style.color=""; (card as HTMLElement).style.opacity=""; });
            updateLegCount();
            const verdict=all("main p").find(p => /^(Blocked\.|Allowed\.)/.test(text(p)));
            if(verdict) verdict.textContent=isBlocked()?"Blocked. The chain combines private data, attacker text and an outbound tool.":"Allowed. At least one risky leg is absent.";
          });
        const aria = b.getAttribute("aria-label") || "";
        if (
          /: (Private data|Untrusted input|Sends out|Destructive)$/.test(aria)
        )
          on(b, "click", () => {
            const pressed = b.getAttribute("aria-pressed") === "true";
            b.setAttribute("aria-pressed", String(!pressed));
            (b as HTMLElement).style.background = pressed
              ? "transparent"
              : "#d9f94a";
            (b as HTMLElement).style.opacity = pressed ? ".25" : "1";
            updateVerdict();
          });
        if (aria === "Reset") on(b, "click", () => location.reload());
      });
      function isBlocked() {
        const flags = all("main button[aria-label]");
        const has = (label: string) =>
          flags.some(
            (b) =>
              b.getAttribute("aria-label")?.endsWith(": " + label) &&
              b.getAttribute("aria-pressed") === "true",
          );
        const blocked =
          has("Private data") && has("Untrusted input") && has("Sends out");
        return blocked;
      }
      function updateLegCount() {
        const labels = ["Private data", "Untrusted input", "Sends out"];
        const count = labels.filter(label => all("main button[aria-label]").some(b => b.getAttribute("aria-label")?.endsWith(": " + label) && b.getAttribute("aria-pressed") === "true")).length;
        const countLine = all("main p").find(p => /^\d\s+of 3 present/.test(text(p)));
        if(countLine) countLine.textContent = `${count} of 3 present. ${count === 3 ? "The edge into the way out gets cut." : "No lethal trifecta. The chain runs."}`;
      }
      function updateVerdict() {
        updateLegCount();
        const blocked = isBlocked();
        const paras = all("main p");
        const verdict = paras.find(
          (p) =>
            text(p).startsWith("Blocked.") || text(p).startsWith("Allowed."),
        );
        if (verdict)
          verdict.textContent = blocked
            ? "Blocked. The plan combines private data, untrusted input and a way out. The outbound edge is cut."
            : "Allowed. At least one leg of the risky chain is absent. This checks plan flags, not model behavior.";
        if (run && text(run) !== "Running…") animateGuard(el, blocked);
      }
      on(run || null, "click", () => {
        if (running) return;
        running = true;
        run!.textContent = "Running…";
        const blocked = isBlocked();
        const timeline = animateGuard(el, blocked);
        if (timeline) {
          cleanup.push(() => timeline.kill());
          timeline.eventCallback("onComplete", () => {
            run!.textContent = "Run it";
            running = false;
            // Outcome is shown in the diagram; do not obscure it with a toast.
          });
        } else {
          run!.textContent = "Run it";
          running = false;
        }
      });
    }
    if (route === "bench") {
      cleanup.push(mountBenchMotion(el));
      for (const b of all('main button[data-slot="accordion-trigger"]')) {
        const name = text(b),
          data = (controlSnapshots.bench as Record<string, { body?: string }>)[
            name
          ];
        let panel = b.parentElement?.nextElementSibling as HTMLElement | null;
        if (!data?.body) continue;
        if(!panel){panel=document.createElement('div');b.parentElement!.after(panel);panel.hidden=true;}
        const html = data.body;
        on(b, "click", () => {
          const open = b.getAttribute("aria-expanded") === "true";
          b.setAttribute("aria-expanded", String(!open));
          panel!.innerHTML = open ? "" : html;
          panel!.hidden = open;
          panel!.style.height = "auto";
          panel!.removeAttribute("data-ending-style");
          if (!open)
            gsap.from(panel, {
              height: 0,
              opacity: 0,
              duration: 0.25,
              ease: "power2.out",
              onComplete: () => {
                panel!.style.height = "auto";
              },
            });
        });
      }
    }
    if (route === "docs") {
      const links=all('a[href^="#"]');
      const spy=new IntersectionObserver(entries => {
        const entry=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
        if(!entry) return;
        links.forEach(a=>{ const active=a.getAttribute("href")==="#"+entry.target.id; a.setAttribute("aria-current",active?"location":"false"); (a as HTMLElement).style.color=active?"#4e6b3a":""; (a as HTMLElement).style.fontWeight=active?"700":""; });
      },{rootMargin:"-80px 0px -60% 0px"});
      all('main section[id]').forEach(n=>spy.observe(n)); cleanup.push(()=>spy.disconnect());
      const configurations = [
        "Claude Code",
        "Claude Desktop",
        "Codex",
        "Cursor",
      ];
      all('main button[role="tab"]').forEach((b) =>
        on(b, "click", () => {
          const name = text(b);
          const config = (docClientConfigs as Record<string,{caption:string;code:string}>)[name];
          b.parentElement!.querySelectorAll("button").forEach(n=>n.setAttribute("aria-selected",String(n===b)));
          if(config) {
            const pre=el.querySelector("#connect pre");
            if(pre) {
              pre.replaceChildren();
              config.code.split("\n").forEach((line,i)=>{const row=document.createElement("div");row.className="cy-line flex gap-4";const num=document.createElement("span");num.className="w-5 shrink-0 text-right text-paper/25";num.textContent=String(i+1);const code=document.createElement("code");code.className="whitespace-pre";code.textContent=line;row.append(num,code);pre.append(row);});
              const caption=pre.parentElement?.querySelector("div > span");if(caption)caption.textContent=config.caption;
            }
            return;
          }
          const apiCode: Record<string,string> = {"HTTP API": `curl http://127.0.0.1:8787/api/plan -H 'content-type: application/json' -d '{"task":"Find open login bugs in Linear"}'`, "MCP stdio": "# After npm publication\nnpx -y switchhboard-mcp", "Health check": "curl http://127.0.0.1:8787/api/health"};
          const pre=el.querySelector("#point pre");
          if(pre && apiCode[name])pre.textContent=apiCode[name];
        }),
      );
    }
    if (route === "login" || route === "signup") {
      const form = el.querySelector("main form");
      const submit = form?.querySelector("button[type=submit]") as HTMLButtonElement | null;
      const validForm = () => { if(submit) submit.disabled = !Array.from(form!.querySelectorAll("input")).every(input => input.checkValidity()); };
      on(form, "input", validForm);
      validForm();
      if(form){const status=document.createElement("p");status.setAttribute("role","status");status.className="mt-3 text-[13px] text-ink/70";status.textContent="Account service is not connected. No password will be sent or saved. You can skip sign-in and plan a task.";form.append(status);}
      on(form, "submit", (e) => {
        e.preventDefault();
        notify(
          "Original account service is not connected. No password has been stored or sent. Use Skip and plan a task.",
        );
      });
      all("main button").forEach((b) => {
        if (
          /Sign up|Log in/.test(text(b)) &&
          b.getAttribute("type") !== "submit"
        )
          on(b, "click", () =>
            notify(
              "Account creation is unavailable in this local rebuild. No credentials are sent.",
            ),
          );
      });
      const p = el.querySelector('main input[type="password"]');
      if (p) p.setAttribute("autocomplete", "off");
      all('main button[aria-label="Show password"]').forEach((b) =>
        on(b, "click", () => {
          const input = el.querySelector(
            'main input[autocomplete="off"]',
          ) as HTMLInputElement;
          input.type = input.type === "password" ? "text" : "password";
          b.setAttribute(
            "aria-label",
            input.type === "password" ? "Show password" : "Hide password",
          );
        }),
      );
    }
    if (route === "runs") {
      const saved = JSON.parse(localStorage.getItem("sb-local-runs") || "[]");
      if (saved.length) {
        const first = el.querySelector("main h1")?.parentElement;
        const extra = document.createElement("div");
        extra.style.cssText =
          "margin-top:24px;padding:20px;border:1px solid #9db08a;border-radius:12px";
        const title = document.createElement("h2");
        title.textContent = "Your local run reports";
        extra.append(title);
        saved.forEach((r: { task: string; ok: boolean }) => {
          const p = document.createElement("p");
          p.textContent = (r.ok ? "✓ " : "× ") + r.task;
          extra.append(p);
        });
        first?.append(extra);
      }
      const main = el.querySelector("main")!;
      const journal = main.innerHTML;
      function bindTabs() {
        main.querySelectorAll('button[role="tab"]').forEach((b) =>
          b.addEventListener("click", () => {
            const memory = text(b) === "My memory";
            main.innerHTML = memory ? controlSnapshots.runs.memory : journal;
            bindTabs();
          }),
        );
      }
      bindTabs();
    }
    return () => {
      cleanup.forEach((f) => f());
    };
  }, [route]);
  useEffect(() => {
    if (task && route === "ask" && root.current) {
      const mount = root.current.querySelector("#local-planner-mount");
      mount?.previousElementSibling?.classList.add("hidden");
    }
  }, [task, route]);
  const results = routes.filter(
    (r) =>
      r.toLowerCase().includes(q.toLowerCase()) ||
      ["plan", "task"].some((t) => q.toLowerCase().includes(t) && r === "Ask"),
  );
  return (
    <>
      <div
        className="rebuild-root"
        ref={root}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {slot &&
        task &&
        createPortal(
          <Planner
            task={task}
            budget={budget}
            onReport={() =>
              notify("Run report saved locally. Open Runs to view it.")
            }
          />,
          slot,
        )}
      {tourInvite && <aside className="new-user-tour" aria-label="New user tour"><span>New here? Take a<br/>30-second tour.</span><button onClick={()=>{setTourInvite(false);localStorage.setItem("sb-tour-dismissed","1");}}>No thanks</button><button onClick={()=>{setTourInvite(false);localStorage.setItem("sb-tour-dismissed","1");startTour();}}>Take the tour</button></aside>}
      {menu && <div className="mobile-menu-overlay"><header><a href="/">Switchboard</a><button aria-label="Close menu" onClick={()=>setMenu(false)}>×</button></header><nav>{routes.map(r=><a key={r} href={"/"+r.toLowerCase()} style={{color:route===r.toLowerCase()?"#d9f94a":undefined}}>{r}</a>)}</nav><a className="mobile-plan" href="/ask">Plan a task</a></div>}
      {cmd && (
        <div className="cmd-overlay" onClick={() => setCmd(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search Switchboard"
            className="cmd-box"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the docs, plan a task, or jump to a page"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  location.href = "/ask?task=" + encodeURIComponent(q);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
                }
              }}
            />
            {results.map((r) => (
              <a
                key={r}
                className="cmd-result"
                href={"/" + r.toLowerCase()}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    (
                      e.currentTarget.nextElementSibling as HTMLElement
                    )?.focus();
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    (
                      e.currentTarget.previousElementSibling as HTMLElement
                    )?.focus();
                  }
                }}
              >
                {r}
                <small style={{ float: "right", opacity: 0.5 }}>
                  Jump to page ↗
                </small>
              </a>
            ))}
            {q && <><p className="cmd-group">Docs</p>{Object.entries({quick:"Quickstart",connect:"Connect your agent",point:"Call the API directly",contract:"The plan contract",servers:"Add your own servers",guard:"Risk flags and the guard",oss:"Where it runs",credits:"Credits and licences"}).filter(([id,label])=>(id+" "+label).toLowerCase().includes(q.toLowerCase())).map(([id,label])=><a className="cmd-result" key={id} href={"/docs#"+id}>{label}<small style={{float:"right",opacity:.5}}>Docs ↗</small></a>)}<p className="cmd-group">Plan a task</p></>}
            {q && (
              <a
                href={"/ask?task=" + encodeURIComponent(q)}
                className="cmd-result"
              >
                Plan "{q}" ↵
              </a>
            )}
            <p style={{ padding: 16, fontSize: 11, opacity: 0.55 }}>
              ↑ ↓ to move · Enter to open · Esc to close
            </p>
          </div>
        </div>
      )}
      {tour >= 0 && (
        <div className="tour-shade">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Switchboard tour"
            className="tour-card"
          >
            <span className="local-label">
              Tour · {tour + 1} of {tourSteps.length}
            </span>
            <h2>{tourSteps[tour][0]}</h2>
            <p>{tourSteps[tour][1]}</p>
            <div className="tour-actions">
              <button onClick={() => setTour(-1)}>Skip tour</button>
              {tour > 0 && (
                <button onClick={() => setTour(tour - 1)}>Back</button>
              )}
              <button
                onClick={() =>
                  setTour(tour === tourSteps.length - 1 ? -1 : tour + 1)
                }
              >
                {tour === tourSteps.length - 1 ? "Done" : "Next →"}
              </button>
            </div>
          </section>
        </div>
      )}
      {node && (
        <aside className="graph-panel" role="dialog" aria-label={node.label}>
          <button onClick={() => setNode(null)} style={{ float: "right" }}>
            ×
          </button>
          <div className="local-label">
            {node.kind} · {node.server}
          </div>
          <h3>{node.label}</h3>
          {"desc" in node && (
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>{node.desc}</p>
          )}
          {"risk" in node &&
            (node.risk as string[]).map((r) => (
              <span className="local-chip" key={r}>
                {r}
              </span>
            ))}
          <p style={{ fontSize: 12 }}>
            degree {node.degree}
            {"schemaTokens" in node
              ? " · " + node.schemaTokens + " schema tokens"
              : ""}
          </p>
          {"consumes" in node && (
            <pre>
              {JSON.stringify(
                { consumes: node.consumes, yields: node.yields },
                null,
                2,
              )}
            </pre>
          )}
          <a
            className="local-chip"
            href={"/ask?task=" + encodeURIComponent("Use " + node.label)}
          >
            Plan with this tool ↗
          </a>
        </aside>
      )}
      {toast && (
        <div className="local-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
