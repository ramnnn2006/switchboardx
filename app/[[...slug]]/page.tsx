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
  return {
    title: name
      ? name[0].toUpperCase() + name.slice(1) + " · Switchboard"
      : "Switchboard · stop loading every tool",
  };
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
