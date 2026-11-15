import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Experience from "../../components/Experience";
const routes = [
  "home",
  "ask",
  "explore",
  "why",
  "bench",
  "guard",
  "runs",
  "docs",
  "login",
  "signup",
];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = slug?.[0];
  const descriptions: Record<string,string> = {
    home:"Explore graph-based MCP tool planning. Choose only the tools a task needs, in dependency order, with typed inputs and risky-chain checks.",
    ask:"Plan MCP tool calls in dependency order. Explore recorded plans, already-known values, tool exclusions and schema details.",
    explore:"Explore 420 MCP tools across 20 servers. Search tools, inspect types and filter private-data, untrusted-input and outbound risk flags.",
    why:"See why graph dependencies matter for agent tool planning, typed context and safer tool chains.",
    bench:"Inspect Switchboard reference benchmarks, token budgets and clearly labeled replay data. Current implementation measurements are tracked separately.",
    guard:"Test how private data, untrusted content and outbound tools combine into a risky chain. Interactive plan-flag demo, not a security guarantee.",
    runs:"Explore recorded run examples and browser-local reports. Account-backed history is not connected.",
    docs:"Set up the switchhboard-mcp package when published. Read MCP client configuration, API examples, schema coverage and current backend status.",
    login:"Switchboard sign-in preview. Account service is not connected; skip sign-in to explore the planner.",
    signup:"Switchboard account preview. Account service is not connected; explore without creating an account.",
  };
  const key=name||"home";const title=name?name[0].toUpperCase()+name.slice(1):"Stop loading every tool";
  return {title, description:descriptions[key],alternates:{canonical:name?"/"+name:"/"},openGraph:{title:title+" | Switchboard",description:descriptions[key],url:name?"/"+name:"/"},...(key==="login"||key==="signup"?{robots:{index:false,follow:true}}:{})};
}
export function generateStaticParams() {
  return routes.map((x) => ({ slug: x === "home" ? [] : [x] }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const route = slug?.[0] || "home";
  if (!routes.includes(route))
    return (
      <main style={{ padding: 80 }}>
        Page not found. <a href="/">Go home</a>
      </main>
    );
  const html = await fs.readFile(
    path.join(process.cwd(), "templates", route + ".html"),
    "utf8",
  );
  return <Experience route={route} html={html} />;
}
