import { test, expect } from "@playwright/test";
import recorded from "../data/recorded-plans.json";
test("all routes, no horizontal overflow", async ({ page }) => {
  for (const route of [
    "",
    "ask",
    "explore",
    "why",
    "bench",
    "guard",
    "runs",
    "docs",
    "login",
    "signup",
  ]) {
    await page.goto("/" + route);
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});
for (const [task, record] of Object.entries(recorded.plans))
  test("recorded plan: " + task, async ({ page }) => {
    await page.goto("/ask?task=" + encodeURIComponent(task));
    await expect(page.locator(".faithful-planner")).toBeVisible();
    await expect(page.locator(".react-flow svg.local-plan-edges")).toBeVisible();
    for (const step of record.plan.steps) {
      const tool = step.tool_id.replace(/^([a-z0-9-]+)\./, "$1/");
      expect(
        (await page.locator(".faithful-planner").innerText()).includes(
          tool.split("/")[1],
        ),
      ).toBeTruthy();
    }
    expect(
      (await page.locator(".faithful-planner").innerText()).includes(
        record.plan.tokens.plan.toLocaleString(),
      ),
    ).toBeTruthy();
  });
test("command palette, theme, driver tour", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("sb-intro-seen", "1"));
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Search Switchboard" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("button", { name: "Take the tour", exact: true })
    .first()
    .click();
  await expect(page.locator(".driver-popover")).toBeVisible();
  await page.locator(".driver-popover-next-btn").click();
  await expect(page.locator(".driver-popover")).toBeVisible();
  await page.keyboard.press("Escape");
});
test("guard flag matrix and demo run", async ({ page }) => {
  await page.goto("/guard");
  await page
    .getByRole("button", {
      name: "gmail.search_emails: Private data",
      exact: true,
    })
    .click();
  await expect(page.locator("main")).toContainText("Allowed.");
  await page
    .getByRole("button", {
      name: "gmail.search_emails: Private data",
      exact: true,
    })
    .click();
  await expect(page.locator("main")).toContainText("Blocked.");
  await page.getByRole("button", { name: "Run it", exact: true }).click();
  await expect(page.locator('svg[aria-label^="Chain"]').locator(".." )).toContainText("Cut before it runs");
});
test("planner stickers, schemas, local run report", async ({ page }) => {
  await page.goto(
    "/ask?task=" +
      encodeURIComponent("Open a PR on acme/api fixing the flaky login test"),
  );
  const sticker = page.getByRole("button", { name: /github.branch =/ });
  await sticker.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-dropzone="held"]')).toContainText(
    "github.branch",
  );
  await page.getByRole("button", { name: "Schemas", exact: true }).click();
  await expect(page.locator("#local-schema-section")).toBeVisible();
  await page
    .getByRole("button", { name: "Close schemas", exact: true })
    .click();
  await page.getByText("Did it work?", { exact: false }).click();
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.locator(".local-toast")).toContainText("saved locally");
  await page.goto("/runs");
  await expect(page.locator("main")).toContainText("Your local run reports");
});
test("explore webgl, search, filters and list", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator("canvas.sigma-nodes")).toBeVisible({
    timeout: 15000,
  });
  await page.getByPlaceholder("find a tool…").fill("create_pull_request");
  await page
    .getByRole("button", { name: "reads private data", exact: true })
    .click();
  await page.getByRole("button", { name: "list view", exact: true }).click();
  await expect(page.locator(".local-tool-list")).toBeVisible();
  await expect(page.locator(".catalog-table th")).toHaveCount(6);
  await expect(page.locator(".catalog-table tbody tr")).toHaveCount(0);
  await page.getByRole("button", { name: "reads private data", exact: true }).click();
  await expect(page.locator(".catalog-table tbody tr")).toHaveCount(1);
  await page.locator(".local-tool-list button").filter({ hasText: "create_pull_request" }).click();
  await expect(page.locator(".graph-panel")).toContainText(
    "create_pull_request",
  );
});
test("login never sends credentials", async ({ page }) => {
  let request = false;
  page.on("request", (r) => {
    if (r.method() === "POST") request = true;
  });
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("test@example.com");
  await page
    .locator('input[type="password"]')
    .fill("test-only-not-a-real-password");
  await page.locator('main button[type="submit"]').click();
  await expect(page.locator(".local-toast")).toContainText("not connected");
  expect(request).toBeFalsy();
});
test("guard scenarios synchronize nodes and matrix", async ({ page }) => {
  await page.goto("/guard");
  await page
    .getByRole("button", { name: "Files to Slack", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "filesystem.read_file: Private data",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('svg[aria-label^="Chain"]')).toContainText(
    "filesystem",
  );
  await page
    .getByRole("button", { name: "Database to public issue", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "postgres.query: Private data",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('svg[aria-label^="Chain"]')).toContainText(
    "postgres",
  );
});
test('pointer sticker drag replans step cards',async({page})=>{
 await page.goto('/ask?task='+encodeURIComponent('Open a PR on acme/api fixing the flaky login test'));
 const sticker=page.locator('[role=button][aria-label^="github.branch ="]').first();
 await expect(sticker).toBeVisible();await sticker.scrollIntoViewIfNeeded();
 const a=await sticker.boundingBox(),b=await page.locator('[data-dropzone=held]').boundingBox();
 if(!a||!b)throw Error('drop geometry missing');
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
 await expect(page.locator('[data-dropzone=held]')).toContainText('github.branch');
 await expect(page.locator('ol[aria-label="Ordered plan steps"] > li')).toHaveCount(1);
 await expect(page.locator('ol[aria-label="Ordered plan steps"]')).toContainText('create_pull_request');
});
test('docs exact configuration tabs, bench accordion, runs memory',async({page})=>{
 await page.goto('/docs');await page.getByRole('tab',{name:'Codex',exact:true}).click();await expect(page.locator('main pre').nth(1)).toContainText('[mcp_servers.switchboard]');
 await page.getByRole('tab',{name:'MCP stdio',exact:true}).click();await expect(page.locator('main pre').nth(2)).toContainText('switchhboard-mcp');
 await page.goto('/bench');await page.getByRole('button',{name:'Hardware',exact:true}).click();await expect(page.getByRole('button',{name:'Hardware',exact:true})).toHaveAttribute('aria-expanded','true');
 await page.goto('/runs');await page.getByRole('tab',{name:'My memory',exact:true}).click();await expect(page.locator('main')).toContainText('Save what you already know.');await page.getByRole('tab',{name:'Run journal',exact:true}).click();await expect(page.locator('main')).toContainText('Open a PR on');
});
test('mobile routes stay within viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>sessionStorage.setItem('sb-intro-seen','1'));
 for(const route of['','ask','why','bench','guard','docs','runs','login','signup']){await page.goto('/'+route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
});
