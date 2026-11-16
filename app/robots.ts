export const dynamic = "force-static";
import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/'},sitemap:'https://switchboardx.vercel.app/sitemap.xml'};}
