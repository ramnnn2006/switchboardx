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
  const titles:Record<string,string>={home:"MCP tool planner with typed dependencies",ask:"Plan MCP tool calls in dependency order",explore:"Explore 420 MCP tools and schemas",why:"Why MCP tools need dependency graphs",bench:"MCP token benchmarks and replay data",guard:"MCP risky-chain guard demo",runs:"Run journal and browser-local reports",docs:"switchhboard-mcp setup and API docs",login:"Sign-in preview",signup:"Account preview"};
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
  const url = "https://switchboardx.vercel.app" + (route === "home" ? "/" : "/" + route);
  const label = route === "home" ? "Switchboard" : route[0].toUpperCase() + route.slice(1);
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": "https://switchboardx.vercel.app/#website", url: "https://switchboardx.vercel.app/", name: "Switchboard", inLanguage: "en" },
      { "@type": "WebPage", "@id": url + "#webpage", url, name: label + " | Switchboard", isPartOf: { "@id": "https://switchboardx.vercel.app/#website" }, inLanguage: "en" },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    <Experience route={route} html={route === "explore" ? html.replace(/<main([^>]*)>/, '<main$1><h1 class="sr-only">Explore the MCP tool catalog</h1>') : html} />
  </>;
}
