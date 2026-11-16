import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Experience from "../../components/Experience";
export const dynamicParams = false;
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
  const key=name||"home";
  const titles:Record<string,string>={home:"Graph-based MCP tool planning",ask:"Plan MCP tool calls",explore:"Explore the MCP tool catalog",why:"Why graph-based tool planning",bench:"Reference benchmarks and token budgets",guard:"Risky-chain guard demo",runs:"Sample run journal",docs:"MCP setup and API documentation",login:"Sign-in preview",signup:"Account preview"};
  const title=titles[key]||"Page not found";
  return {title, description:descriptions[key],alternates:{canonical:name?"/"+name:"/"},openGraph:{title:title+" | Switchboard",description:descriptions[key],type:"website",siteName:"Switchboard",url:name?"/"+name:"/",images:[{url:"/og-switchboard.jpg",width:1200,height:630,alt:"Switchboard. Stop loading every tool."}]},twitter:{card:"summary_large_image",title:title+" | Switchboard",description:descriptions[key],images:["/og-switchboard.jpg"]},...(key==="login"||key==="signup"?{robots:{index:false,follow:true}}:{})};
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
  if (!routes.includes(route) || (slug?.length || 0)>1) notFound();
  const html = await fs.readFile(
    path.join(process.cwd(), "templates", route + ".html"),
    "utf8",
  );
  return <Experience route={route} html={html} />;
}
