import { test, expect } from '@playwright/test';
for (const route of ['', 'ask', 'explore', 'why', 'bench', 'guard', 'runs', 'docs', 'login', 'signup']) {
 test('SEO metadata and structured data: /'+route, async ({page}) => {
  await page.goto('/'+route);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp('^https://switchboardx\\.vercel\\.app'+(route?'/'+route:'')+'/?$'));
  const data=JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data['@graph'].map((v:{'@type':string})=>v['@type'])).toEqual(['WebSite','WebPage']);
  if(['login','signup'].includes(route)) await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
 });
}
test('honest answer text, crawlable noindex and mobile layout',async({page,request})=>{
 const robots=await (await request.get('/robots.txt')).text();expect(robots).not.toContain('Disallow: /login');
 await page.setViewportSize({width:390,height:844});await page.goto('/docs');
 await expect(page.locator('#questions')).toContainText('No. The website is a browser-local interactive demo');
 await expect(page.locator('#questions')).toContainText('unauthenticated');
 await page.locator('#questions').scrollIntoViewIfNeeded();await page.screenshot({path:'verification/seo-docs-answers-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.goto('/explore');await page.screenshot({path:'verification/seo-explore-mobile.png'});
});
