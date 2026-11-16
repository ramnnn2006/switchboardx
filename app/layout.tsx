import type { Metadata } from "next";
import "./rebuild.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://switchboardx.vercel.app"),
  title: { default: "Switchboard | Stop loading every tool", template: "%s | Switchboard" },
  description: "Explore a graph of 420 MCP tools. Plan tool calls in dependency order, inspect schemas and test risky-chain checks. The website is a browser-local interactive demo; a separate public HydraDB API is available for synthetic data only.",
  applicationName: "Switchboard",
  openGraph: { type:"website", siteName:"Switchboard", title:"Switchboard: stop loading every tool", description:"Graph-based MCP tool planning, typed context and risky-chain checks.", images:[{url:"/og-switchboard.jpg",width:1200,height:630,alt:"Switchboard. Stop loading every tool."}] },
  twitter:{card:"summary_large_image",title:"Switchboard: stop loading every tool",description:"Graph-based MCP tool planning and agent context.",images:["/og-switchboard.jpg"]},
  icons:{icon:"/switchboard-icon.svg"},
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="fsfPSG_variable Ab9sXW_variable yQaYtW_variable antialiased light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{__html:`if(location.pathname==='/'){document.documentElement.setAttribute('data-visual','loading');setTimeout(()=>document.documentElement.removeAttribute('data-visual'),10000)}`}} />
        {[
          "ClashDisplay_Bold-s.p.02rna9r7q7wbm.woff2",
          "ClashDisplay_Semibold-s.p.0b2bvltr7mr4j.woff2",
          "ClashDisplay_Medium-s.p.1o1yivy7iyl8g.woff2",
          "605ce01b664af129-s.p.0zr6hhvz-h9nw.woff2",
          "07a39a8a4660cc7c-s.p.1v5bejj26fx9h.woff2",
        ].map((font) => (
          <link
            key={font}
            rel="preload"
            href={"/assets/static/immutable/media/" + font}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        <link rel="preload" href="/photos/tuscan-meadow.webp" as="image" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname==='/'&&!sessionStorage.getItem('sb-intro-seen')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.setAttribute('data-assembly','pending');setTimeout(()=>document.documentElement.removeAttribute('data-assembly'),12000)}}catch(e){}`,
          }}
        />
        <link
          rel="stylesheet"
          href="/assets/static/immutable/chunks/155j4s_qqgqps.css"
        />
        <link
          rel="stylesheet"
          href="/assets/static/immutable/chunks/3k4_-ab8gtnt7.css"
        />
        <link
          rel="stylesheet"
          href="/assets/static/immutable/chunks/28oc4b1t4j-27.css"
        />
        <link
          rel="stylesheet"
          href="/assets/static/immutable/chunks/3ocbmb7g7s8x5.css"
        />
        <script dangerouslySetInnerHTML={{__html:`if(location.pathname==='/'){const image=new Image();image.src='/photos/tuscan-meadow.webp';Promise.allSettled([document.fonts.load('700 100px display'),document.fonts.load('400 18px Geist'),image.decode()]).then(()=>document.documentElement.removeAttribute('data-visual'))}`}} />
      </head>
      <body className="grain min-h-screen flex flex-col bg-paper text-ink">
        <div className="component-loading" role="status"><svg width="20" height="24" viewBox="0 0 22 26" aria-hidden="true"><path d="M2 2L3 22L9 16L14 25L18 23L13 14L21 13Z" fill="#d9f94a" stroke="#1f2a1c" strokeWidth="1.5"/></svg><span>Preparing components...</span></div>
        {children}
      </body>
    </html>
  );
}
