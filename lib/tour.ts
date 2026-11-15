import { driver } from "driver.js";
import "driver.js/dist/driver.css";
const steps = [
  [
    "hero",
    "What Switchboard does",
    "An MCP server for your agent. Each task gets only the tools it calls, in call order.",
    "bottom",
  ],
  [
    "plan",
    "A real plan",
    "One task, planned by the engine. Each row is one tool call.",
    "top",
  ],
  [
    "receipt",
    "What it saves",
    "Struck: tokens to preload every schema. Lime: tokens for this plan.",
    "top",
  ],
  [
    "production",
    "How it works",
    "Connect your MCP servers. Switchboard maps their tools into a typed graph and plans each task against it.",
    "top",
  ],
  [
    "nav-/ask",
    "Try your own task",
    "Type any task and get the plan back.",
    "bottom",
  ],
  [
    "nav-/explore",
    "See the graph",
    "Every tool and type, as one graph.",
    "bottom",
  ],
];
export function startTour() {
  const visible = steps
    .filter(([key]) => {
      const n = document.querySelector(
        `[data-tour="${key}"]`,
      ) as HTMLElement | null;
      return n && n.offsetWidth > 0;
    })
    .map(([key, title, description, side]) => ({
      element: `[data-tour="${key}"]`,
      popover: {
        title,
        description,
        side: side as "top" | "bottom",
        align: "start" as const,
      },
    }));
  const tour = driver({
    steps: [
      ...visible,
      {
        popover: {
          title: "Connect your agent",
          description: "One config block for Claude, Codex or Cursor.",
          doneBtnText: "Open the docs",
        },
      },
    ],
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    popoverClass: "sb-tour",
    stagePadding: 8,
    stageRadius: 16,
    overlayColor: "#0B0F0A",
    overlayOpacity: 0.55,
    popoverOffset: 14,
    smoothScroll: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    onDestroyStarted: () => tour.destroy(),
    onNextClick: () => {
      if (!tour.hasNextStep()) {
        tour.destroy();
        location.href = "/docs#connect";
      } else tour.moveNext();
    },
  });
  tour.drive();
  return tour;
}
