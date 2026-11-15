import type { plan } from "./planner";

/**
 * Plan diagram faithful to the live Switchboard Ask page: sticker-style step
 * nodes with number badge, per-server tool icon and risk chips, a Pip mascot
 * riding the final node, and labelled edge groups. Node markup mirrors the
 * original's captured DOM (data/solved-markup.json); icon paths, server
 * colors and the mascot SVG are copied verbatim from the original site.
 */

const SERVER_COLORS: Record<string, string> = {
  "atlassian": "rgb(255, 230, 109)",
  "filesystem": "rgb(157, 176, 138)",
  "github": "rgb(157, 176, 138)",
  "playwright": "rgb(189, 224, 254)",
  "firecrawl": "rgb(189, 224, 254)",
  "git": "rgb(255, 230, 109)",
  "supabase": "rgb(255, 200, 221)",
  "gmail": "rgb(255, 230, 109)",
  "puppeteer": "rgb(255, 230, 109)",
  "linear": "rgb(189, 224, 254)",
  "gitlab": "rgb(157, 176, 138)",
  "google-maps": "rgb(157, 176, 138)",
  "time": "rgb(189, 224, 254)",
  "notion": "rgb(189, 224, 254)",
  "google-calendar": "rgb(255, 230, 109)",
  "memory": "rgb(189, 224, 254)"
};

const SERVER_ICONS: Record<string, string> = {
  "atlassian": "triangle",
  "filesystem": "folder",
  "github": "git-branch",
  "gitlab": "git-merge",
  "git": "git-commit-horizontal",
  "gmail": "mail",
  "supabase": "zap",
  "playwright": "play",
  "puppeteer": "mouse-pointer-click",
  "firecrawl": "flame",
  "linear": "list-checks",
  "notion": "file-text",
  "google-calendar": "calendar-days",
  "google-maps": "map-pin",
  "memory": "brain",
  "time": "clock"
};

const RISK_ICONS: Record<string, string> = {
  "reads_private": "lock",
  "ingests_untrusted": "biohazard",
  "exfil_sink": "send",
  "destructive": "triangle-alert"
};

/** Lucide icon inner SVG, extracted verbatim from the original site. */
const ICON_PATHS: Record<string, string> = {
  "biohazard": `<circle cx="12" cy="11.9" r="2"></circle><path d="M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 9 3.7 9.6 2 11.6"></path><path d="m8.9 10.1 1.4.8"></path><path d="M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4-1.2 5.2-.6 6.9 1.5"></path><path d="m15.1 10.1-1.4.8"></path><path d="M16.7 20.8c-2.6-.4-4.6-2.6-4.7-5.3-.2 2.6-2.1 4.8-4.7 5.2"></path><path d="M12 13.9v1.6"></path><path d="M13.5 5.4c-1-.2-2-.2-3 0"></path><path d="M17 16.4c.7-.7 1.2-1.6 1.5-2.5"></path><path d="M5.5 13.9c.3.9.8 1.8 1.5 2.5"></path>`,
  "brain": `<path d="M12 18V5"></path><path d="M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4"></path><path d="M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294"></path><path d="M17.996 5.125a4 4 0 012.526 5.77"></path><path d="M18 18a4 4 0 002-7.465"></path><path d="M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517"></path><path d="M6 18a4 4 0 01-2-7.465"></path><path d="M6.004 5.125a4 4 0 00-2.526 5.77"></path>`,
  "calendar-days": `<path d="M8 2v3"></path><path d="M16 2v3"></path><rect height="18" rx="2" width="18" x="3" y="3"></rect><path d="M3 9h18"></path><path d="M8 13h.01"></path><path d="M12 13h.01"></path><path d="M16 13h.01"></path><path d="M8 17h.01"></path><path d="M12 17h.01"></path><path d="M16 17h.01"></path>`,
  "clock": `<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>`,
  "file-text": `<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>`,
  "flame": `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"></path>`,
  "folder": `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>`,
  "git-branch": `<path d="M15 6a9 9 0 0 0-9 9V3"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle>`,
  "git-commit-horizontal": `<path d="M15 6a9 9 0 0 0-9 9V3"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle>`,
  "git-merge": `<circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path>`,
  "list-checks": `<path d="M13 5h8"></path><path d="M13 12h8"></path><path d="M13 19h8"></path><path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path>`,
  "lock": `<rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`,
  "mail": `<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path><rect height="16" rx="2" width="20" x="2" y="4"></rect>`,
  "map-pin": `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>`,
  "mouse-pointer-click": `<path d="M14 4.1 12 6"></path><path d="m5.1 8-2.9-.8"></path><path d="m6 12-1.9 2"></path><path d="M7.2 2.2 8 5.1"></path><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"></path>`,
  "play": `<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path>`,
  "send": `<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path>`,
  "triangle": `<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>`,
  "triangle-alert": `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>`,
  "zap": `<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"></path>`
};

/** Pip Detective mascot, copied verbatim from the original solved-plan DOM. */
const PIP_SVG = `<svg aria-label="Pip Detective Sticker" class="" fill="none" height="46" role="img" shape-rendering="crispEdges" style="display: inline-block; transform-origin: center center;" viewBox="0 0 38 38" width="46" xmlns="http://www.w3.org/2000/svg"><g id="pip-detective"><g id="sticker-edge-outer"><rect fill="#D5DBE3" height="1" width="5" x="17" y="5"></rect><rect fill="#D5DBE3" height="1" width="7" x="16" y="6"></rect><rect fill="#D5DBE3" height="1" width="11" x="14" y="7"></rect><rect fill="#D5DBE3" height="1" width="13" x="13" y="8"></rect><rect fill="#D5DBE3" height="1" width="15" x="12" y="9"></rect><rect fill="#D5DBE3" height="1" width="17" x="11" y="10"></rect><rect fill="#D5DBE3" height="1" width="19" x="10" y="11"></rect><rect fill="#D5DBE3" height="1" width="21" x="9" y="12"></rect><rect fill="#D5DBE3" height="1" width="21" x="9" y="13"></rect><rect fill="#D5DBE3" height="1" width="21" x="9" y="14"></rect><rect fill="#D5DBE3" height="1" width="21" x="9" y="15"></rect><rect fill="#D5DBE3" height="1" width="21" x="9" y="16"></rect><rect fill="#D5DBE3" height="1" width="23" x="8" y="17"></rect><rect fill="#D5DBE3" height="1" width="24" x="8" y="18"></rect><rect fill="#D5DBE3" height="1" width="26" x="7" y="19"></rect><rect fill="#D5DBE3" height="1" width="27" x="7" y="20"></rect><rect fill="#D5DBE3" height="1" width="28" x="7" y="21"></rect><rect fill="#D5DBE3" height="1" width="28" x="7" y="22"></rect><rect fill="#D5DBE3" height="1" width="28" x="7" y="23"></rect><rect fill="#D5DBE3" height="1" width="28" x="7" y="24"></rect><rect fill="#D5DBE3" height="1" width="28" x="7" y="25"></rect><rect fill="#D5DBE3" height="1" width="27" x="8" y="26"></rect><rect fill="#D5DBE3" height="1" width="28" x="8" y="27"></rect><rect fill="#D5DBE3" height="1" width="28" x="9" y="28"></rect><rect fill="#D5DBE3" height="1" width="28" x="10" y="29"></rect><rect fill="#D5DBE3" height="1" width="28" x="10" y="30"></rect><rect fill="#D5DBE3" height="1" width="19" x="10" y="31"></rect><rect fill="#D5DBE3" height="1" width="8" x="30" y="31"></rect><rect fill="#D5DBE3" height="1" width="19" x="10" y="32"></rect><rect fill="#D5DBE3" height="1" width="6" x="31" y="32"></rect><rect fill="#D5DBE3" height="1" width="19" x="10" y="33"></rect><rect fill="#D5DBE3" height="1" width="4" x="32" y="33"></rect><rect fill="#D5DBE3" height="1" width="8" x="11" y="34"></rect><rect fill="#D5DBE3" height="1" width="8" x="20" y="34"></rect><rect fill="#D5DBE3" height="1" width="6" x="12" y="35"></rect><rect fill="#D5DBE3" height="1" width="6" x="21" y="35"></rect></g><g id="sticker-edge-white"><rect fill="#FFFFFF" height="1" width="5" x="17" y="6"></rect><rect fill="#FFFFFF" height="1" width="7" x="16" y="7"></rect><rect fill="#FFFFFF" height="1" width="11" x="14" y="8"></rect><rect fill="#FFFFFF" height="1" width="13" x="13" y="9"></rect><rect fill="#FFFFFF" height="1" width="15" x="12" y="10"></rect><rect fill="#FFFFFF" height="1" width="17" x="11" y="11"></rect><rect fill="#FFFFFF" height="1" width="19" x="10" y="12"></rect><rect fill="#FFFFFF" height="1" width="19" x="10" y="13"></rect><rect fill="#FFFFFF" height="1" width="19" x="10" y="14"></rect><rect fill="#FFFFFF" height="1" width="19" x="10" y="15"></rect><rect fill="#FFFFFF" height="1" width="19" x="10" y="16"></rect><rect fill="#FFFFFF" height="1" width="21" x="9" y="17"></rect><rect fill="#FFFFFF" height="1" width="21" x="9" y="18"></rect><rect fill="#FFFFFF" height="1" width="24" x="8" y="19"></rect><rect fill="#FFFFFF" height="1" width="25" x="8" y="20"></rect><rect fill="#FFFFFF" height="1" width="26" x="8" y="21"></rect><rect fill="#FFFFFF" height="1" width="26" x="8" y="22"></rect><rect fill="#FFFFFF" height="1" width="26" x="8" y="23"></rect><rect fill="#FFFFFF" height="1" width="26" x="8" y="24"></rect><rect fill="#FFFFFF" height="1" width="26" x="8" y="25"></rect><rect fill="#FFFFFF" height="1" width="25" x="9" y="26"></rect><rect fill="#FFFFFF" height="1" width="26" x="9" y="27"></rect><rect fill="#FFFFFF" height="1" width="26" x="10" y="28"></rect><rect fill="#FFFFFF" height="1" width="26" x="11" y="29"></rect><rect fill="#FFFFFF" height="1" width="17" x="11" y="30"></rect><rect fill="#FFFFFF" height="1" width="7" x="30" y="30"></rect><rect fill="#FFFFFF" height="1" width="17" x="11" y="31"></rect><rect fill="#FFFFFF" height="1" width="6" x="31" y="31"></rect><rect fill="#FFFFFF" height="1" width="17" x="11" y="32"></rect><rect fill="#FFFFFF" height="1" width="4" x="32" y="32"></rect><rect fill="#FFFFFF" height="1" width="8" x="11" y="33"></rect><rect fill="#FFFFFF" height="1" width="8" x="20" y="33"></rect><rect fill="#FFFFFF" height="1" width="6" x="12" y="34"></rect><rect fill="#FFFFFF" height="1" width="6" x="21" y="34"></rect></g><g id="art"><rect fill="#5E452B" height="1" width="3" x="18" y="8"></rect><rect fill="#5E452B" height="1" width="3" x="18" y="9"></rect><rect fill="#8B6B45" height="1" width="9" x="15" y="10"></rect><rect fill="#8B6B45" height="1" width="2" x="14" y="11"></rect><rect fill="#6E5236" height="1" width="1" x="16" y="11"></rect><rect fill="#8B6B45" height="1" width="1" x="17" y="11"></rect><rect fill="#6E5236" height="1" width="1" x="18" y="11"></rect><rect fill="#8B6B45" height="1" width="1" x="19" y="11"></rect><rect fill="#6E5236" height="1" width="1" x="20" y="11"></rect><rect fill="#8B6B45" height="1" width="1" x="21" y="11"></rect><rect fill="#6E5236" height="1" width="1" x="22" y="11"></rect><rect fill="#8B6B45" height="1" width="2" x="23" y="11"></rect><rect fill="#8B6B45" height="1" width="2" x="13" y="12"></rect><rect fill="#6E5236" height="1" width="1" x="15" y="12"></rect><rect fill="#8B6B45" height="1" width="1" x="16" y="12"></rect><rect fill="#6E5236" height="1" width="1" x="17" y="12"></rect><rect fill="#8B6B45" height="1" width="1" x="18" y="12"></rect><rect fill="#6E5236" height="1" width="1" x="19" y="12"></rect><rect fill="#8B6B45" height="1" width="1" x="20" y="12"></rect><rect fill="#6E5236" height="1" width="1" x="21" y="12"></rect><rect fill="#8B6B45" height="1" width="1" x="22" y="12"></rect><rect fill="#6E5236" height="1" width="1" x="23" y="12"></rect><rect fill="#8B6B45" height="1" width="2" x="24" y="12"></rect><rect fill="#5E452B" height="1" width="15" x="12" y="13"></rect><rect fill="#5E452B" height="1" width="15" x="12" y="14"></rect><rect fill="#3FB8AF" height="1" width="11" x="14" y="15"></rect><rect fill="#3FB8AF" height="1" width="2" x="13" y="16"></rect><rect fill="#7FDCD2" height="1" width="2" x="15" y="16"></rect><rect fill="#3FB8AF" height="1" width="9" x="17" y="16"></rect><rect fill="#3FB8AF" height="1" width="2" x="12" y="17"></rect><rect fill="#7FDCD2" height="1" width="2" x="14" y="17"></rect><rect fill="#3FB8AF" height="1" width="11" x="16" y="17"></rect><rect fill="#3FB8AF" height="1" width="3" x="11" y="18"></rect><rect fill="#7FDCD2" height="1" width="1" x="14" y="18"></rect><rect fill="#3FB8AF" height="1" width="13" x="15" y="18"></rect><rect fill="#3FB8AF" height="1" width="17" x="11" y="19"></rect><rect fill="#3FB8AF" height="1" width="5" x="10" y="20"></rect><rect fill="#FFFFFF" height="1" width="1" x="15" y="20"></rect><rect fill="#1B2A3A" height="1" width="1" x="16" y="20"></rect><rect fill="#3FB8AF" height="1" width="12" x="17" y="20"></rect><rect fill="#3FB8AF" height="1" width="5" x="10" y="21"></rect><rect fill="#1B2A3A" height="1" width="2" x="15" y="21"></rect><rect fill="#3FB8AF" height="1" width="5" x="17" y="21"></rect><rect fill="#1B2A3A" height="1" width="3" x="22" y="21"></rect><rect fill="#3FB8AF" height="1" width="1" x="25" y="21"></rect><rect fill="#5B6673" height="1" width="5" x="26" y="21"></rect><rect fill="#3FB8AF" height="1" width="5" x="10" y="22"></rect><rect fill="#1B2A3A" height="1" width="2" x="15" y="22"></rect><rect fill="#3FB8AF" height="1" width="8" x="17" y="22"></rect><rect fill="#5B6673" height="1" width="2" x="25" y="22"></rect><rect fill="#CFEFFF" height="1" width="3" x="27" y="22"></rect><rect fill="#5B6673" height="1" width="2" x="30" y="22"></rect><rect fill="#3FB8AF" height="1" width="15" x="10" y="23"></rect><rect fill="#5B6673" height="1" width="1" x="25" y="23"></rect><rect fill="#CFEFFF" height="1" width="1" x="26" y="23"></rect><rect fill="#FFFFFF" height="1" width="1" x="27" y="23"></rect><rect fill="#CFEFFF" height="1" width="3" x="28" y="23"></rect><rect fill="#5B6673" height="1" width="1" x="31" y="23"></rect><rect fill="#3FB8AF" height="1" width="3" x="10" y="24"></rect><rect fill="#F58FA6" height="1" width="1" x="13" y="24"></rect><rect fill="#3FB8AF" height="1" width="11" x="14" y="24"></rect><rect fill="#5B6673" height="1" width="1" x="25" y="24"></rect><rect fill="#CFEFFF" height="1" width="5" x="26" y="24"></rect><rect fill="#5B6673" height="1" width="1" x="31" y="24"></rect><rect fill="#3FB8AF" height="1" width="7" x="11" y="25"></rect><rect fill="#1B2A3A" height="1" width="2" x="18" y="25"></rect><rect fill="#9BE8DE" height="1" width="1" x="20" y="25"></rect><rect fill="#3FB8AF" height="1" width="4" x="21" y="25"></rect><rect fill="#5B6673" height="1" width="1" x="25" y="25"></rect><rect fill="#CFEFFF" height="1" width="5" x="26" y="25"></rect><rect fill="#5B6673" height="1" width="1" x="31" y="25"></rect><rect fill="#3FB8AF" height="1" width="4" x="11" y="26"></rect><rect fill="#9BE8DE" height="1" width="9" x="15" y="26"></rect><rect fill="#3FB8AF" height="1" width="1" x="24" y="26"></rect><rect fill="#5B6673" height="1" width="2" x="25" y="26"></rect><rect fill="#CFEFFF" height="1" width="3" x="27" y="26"></rect><rect fill="#5B6673" height="1" width="2" x="30" y="26"></rect><rect fill="#2E968F" height="1" width="2" x="12" y="27"></rect><rect fill="#9BE8DE" height="1" width="11" x="14" y="27"></rect><rect fill="#2E968F" height="1" width="1" x="25" y="27"></rect><rect fill="#5B6673" height="1" width="4" x="26" y="27"></rect><rect fill="#6B4423" height="1" width="2" x="30" y="27"></rect><rect fill="#2E968F" height="1" width="1" x="13" y="28"></rect><rect fill="#9BE8DE" height="1" width="11" x="14" y="28"></rect><rect fill="#2E968F" height="1" width="1" x="25" y="28"></rect><rect fill="#6B4423" height="1" width="2" x="31" y="28"></rect><rect fill="#9BE8DE" height="1" width="11" x="14" y="29"></rect><rect fill="#6B4423" height="1" width="2" x="32" y="29"></rect><rect fill="#1F6F6A" height="1" width="4" x="13" y="30"></rect><rect fill="#9BE8DE" height="1" width="5" x="17" y="30"></rect><rect fill="#1F6F6A" height="1" width="4" x="22" y="30"></rect><rect fill="#6B4423" height="1" width="2" x="33" y="30"></rect><rect fill="#1F6F6A" height="1" width="4" x="13" y="31"></rect><rect fill="#1F6F6A" height="1" width="4" x="22" y="31"></rect><rect fill="#1F6F6A" height="1" width="4" x="13" y="32"></rect><rect fill="#1F6F6A" height="1" width="4" x="22" y="32"></rect></g></g></svg>`;

export function serverColor(server?: string): string {
  return SERVER_COLORS[server || ""] || "rgb(157, 176, 138)";
}

export function iconSvg(name: string, size = 16): string {
  const inner = ICON_PATHS[name] || ICON_PATHS["search"];
  return `<svg aria-hidden="true" class="lucide lucide-${name}" fill="none" height="${size}" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" style="vertical-align:-0.125em;flex-shrink:0" viewBox="0 0 24 24" width="${size}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

export function serverIconSvg(server?: string, size = 16): string {
  return iconSvg(SERVER_ICONS[server || ""] || "search", size);
}

type NodeBox = { id: string; el: HTMLElement; x: number; y: number };

/** Accessible plan diagram with pan and zoom. */
export function drawPlan(
  host: HTMLElement,
  result: ReturnType<typeof plan>,
  whole = false,
) {
  if (whole) {
    const frame = document.createElement("iframe");
    frame.src = "/explore?embed=1&path=" + encodeURIComponent(result.steps.map(s=>s.id).join(","));
    frame.title = "Whole graph";
    frame.style.cssText = "width:100%;height:100%;border:0";
    host.append(frame);
    return;
  }
  host.style.position = "relative";
  const mobile = host.clientWidth < 600;
  if(mobile) host.style.setProperty("height", `${Math.max(330, 175 + result.steps.length * 112)}px`, "important");
  const viewport = document.createElement("div");
  viewport.className = "local-plan-viewport";
  viewport.style.cssText = "position:absolute;inset:0;transform-origin:0 0";
  host.append(viewport);
  const ns = "http://www.w3.org/2000/svg";
  const edges = document.createElementNS(ns, "svg");
  edges.setAttribute("class", "local-plan-edges");
  edges.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none";
  viewport.append(edges);

  const boxes: NodeBox[] = [];
  const place = (id: string, x: number, y: number, html: string, testid: string) => {
    const node = document.createElement("div");
    node.className = "react-flow__node nopan";
    node.setAttribute("data-id", id);
    node.setAttribute("data-testid", testid);
    node.setAttribute("role", "group");
    node.tabIndex = 0;
    node.style.cssText = `position:absolute;transform:translate(${x}px, ${y}px)`;
    node.innerHTML = html;
    viewport.append(node);
    boxes.push({ id, el: node, x, y });
    return node;
  };

  // Held values, same content and slots as the original (held-1 top, held-0 bottom).
  const heldHtml = (label: string) =>
    `<div class="trail-node relative" data-seq="0"><div class="rounded-md border border-ink/40 bg-paper px-3 py-2 shadow-sm"><div class="specimen inline-block text-moss">held · ${label}</div></div></div>`;
  place("held-1", 20, 20, heldHtml("text.query"), "rf__node-held-1");
  place("held-0", mobile ? 200 : 20, mobile ? 20 : 130, heldHtml("session"), "rf__node-held-0");

  const blocked = result.guard === "blocked";
  const ring = blocked
    ? "#1f2a1c 0 0 0 3px, #ff5a36 0 0 0 6px, rgba(31,42,28,.5) 0 8px 16px -8px"
    : "#1f2a1c 0 0 0 3px, #d9f94a 0 0 0 6px, rgba(31,42,28,.5) 0 8px 16px -8px";

  result.steps.forEach((s, i) => {
    const x = mobile ? 45 : 254 + (i % 2) * 294,
      y = mobile ? 130 + i * 112 : 76 + Math.floor(i / 2) * 120;
    const toolId = `${s.server}/${s.label}`;
    const risks = (s.risk || [])
      .map(
        (r) =>
          `<span aria-label="risk: ${r}" class="ml-1 flex gap-0.5"><span class="grid h-5 w-5 place-items-center rounded-full bg-ink text-butter" title="${r}">${iconSvg(RISK_ICONS[r] || "search", 12)}</span></span>`,
      )
      .join("");
    place(
      `step-${i + 1}`,
      x,
      y,
      `<div class="trail-node group relative" data-seq="${i + 1}" data-state="path">` +
        `<div class="sticker inline-flex items-center gap-2 font-mono leading-none text-ink px-3.5 py-2.5 text-[13px]" data-tool="${toolId}" style="background:${serverColor(s.server)};box-shadow:${ring}">` +
        `<span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-lime">${i + 1}</span>` +
        `<span class="opacity-75">${serverIconSvg(s.server)}</span>` +
        `<span class="flex flex-col gap-0.5 text-left"><span class="text-[0.8em] opacity-55">${s.server}</span><span class="font-bold">${s.label}</span></span>` +
        risks +
        `<span aria-hidden="true" class="peel"></span></div>` +
        `<button aria-label="Exclude ${toolId}" class="nodrag absolute -right-2 -top-2 hidden h-6 w-6 place-items-center rounded-full bg-ink text-[11px] text-paper shadow group-hover:grid focus:grid" title="Peel off to exclude this tool">✕</button>` +
        `</div>`,
      `rf__node-step-${i + 1}`,
    );
  });

  // Pip mascot rides the final step node, as on the original.
  const last = boxes[boxes.length - 1];
  if (result.steps.length && last) {
    const pip = document.createElement("div");
    pip.className = "pointer-events-none";
    pip.style.cssText = `position:absolute;z-index:10;width:46px;height:46px;transform:translate(${last.x - 26}px, ${last.y - 9}px)`;
    pip.innerHTML = PIP_SVG;
    viewport.append(pip);
  }

  // Labelled edge groups, matching the original's "Edge from X to Y" structure.
  const byId = Object.fromEntries(boxes.map((b) => [b.id, b]));
  const center = (b: NodeBox, side: "left" | "right") => {
    const w = b.el.offsetWidth || 150,
      h = b.el.offsetHeight || 40;
    return [side === "right" ? b.x + w : b.x, b.y + h / 2];
  };
  const pairs: [string, string][] = [];
  if (result.steps.length) {
    pairs.push(["held-1", "step-1"], ["held-0", "step-1"]);
    for (let i = 1; i < result.steps.length; i++)
      pairs.push([`step-${i}`, `step-${i + 1}`]);
  }
  for (const [a, b] of pairs) {
    if (!byId[a] || !byId[b]) continue;
    const [sx, sy] = center(byId[a], "right");
    const [tx, ty] = center(byId[b], "left");
    const mx = (sx + tx) / 2;
    const d = `M ${sx} ${sy} C ${mx} ${sy} ${mx} ${ty} ${tx} ${ty}`;
    const g = document.createElementNS(ns, "g");
    g.setAttribute("role", "group");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", `Edge from ${a} to ${b}`);
    g.setAttribute("class", "react-flow__edge");
    const stroke = blocked ? "#FF5A36" : "#D9F94A";
    g.innerHTML =
      `<path d="${d}" fill="none" stroke="#1F2A1C" stroke-linecap="round" stroke-opacity="0.12" stroke-width="10"></path>` +
      `<path class="trail-edge" d="${d}" fill="none" stroke="#1F2A1C" stroke-linecap="round" stroke-width="8.5"></path>` +
      `<path class="trail-edge" d="${d}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-width="5.5"></path>`;
    edges.append(g);
  }

  // Pan and zoom.
  let scale = 1,
    px = 0,
    py = 0,
    drag = false,
    lastX = 0,
    lastY = 0;
  const update = () =>
    viewport.style.setProperty(
      "transform",
      `translate(${px}px, ${py}px) scale(${scale})`,
      "important",
    );
  const fitNow = () => {
    const right = Math.max(
      ...boxes.map((b) => b.x + (b.el.offsetWidth || 150)),
      0,
    );
    const bottom = Math.max(
      ...boxes.map((b) => b.y + (b.el.offsetHeight || 40)),
      0,
    );
    const fit = Math.min(
      1,
      (host.clientWidth - 24) / right,
      (host.clientHeight - 24) / bottom,
    );
    if (fit > 0 && fit < 1) {
      scale = fit;
      update();
    }
  };
  fitNow();
  requestAnimationFrame(fitNow);
  document.fonts.ready.then(fitNow);
  setTimeout(fitNow,250);
  host.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      scale = Math.max(0.4, Math.min(3, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      update();
    },
    { passive: false },
  );
  host.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  host.addEventListener("pointermove", (e) => {
    if (drag) {
      px += e.clientX - lastX;
      py += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      update();
    }
  });
  host.addEventListener("pointerup", () => (drag = false));
}
