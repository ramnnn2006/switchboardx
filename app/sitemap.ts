export const dynamic = "force-static";
import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap{return ['','ask','explore','why','bench','guard','runs','docs'].map(p=>({url:'https://switchboardx.vercel.app/'+p,changeFrequency:'weekly',priority:p?0.7:1}));}
