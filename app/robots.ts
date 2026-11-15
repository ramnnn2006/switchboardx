export const dynamic = "force-static";
import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/login','/signup']},sitemap:'https://switchboardx.vercel.app/sitemap.xml'};}
