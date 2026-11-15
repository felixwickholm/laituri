/**
 * Captures the screenshots in docs/images from a running Laituri (the live demo by default) in a fresh sandbox:
 * Today, the weekly order run, the approver's phone, the limits, the event menus, Valio Aimo's overview and demand,
 * and the security page. Used by the README and the brief (docs/brief).
 *
 *   npx tsx scripts/screens.ts [baseUrl]
 *
 * Needs Google Chrome, or a Playwright Chromium (CHROME_PATH overrides).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

const BASE = (process.argv[2] ?? "https://laituri.wicflow.com").replace(/\/$/, "");
const OUT = path.join(process.cwd(), "docs", "images");

async function shot(page: Page, name: string, settle = 2500) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 82 });
  console.log(name, page.url());
}

async function open(page: Page, route: string) {
  await page.goto(`${BASE}${route}${route.includes("?") ? "&" : "?"}tour=off`, { waitUntil: "networkidle" });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
  const page = await desk.newPage();

  await open(page, "/buyer");
  await shot(page, "today");

  await page.getByRole("button", { name: /Order this week/ }).first().click();
  await page.waitForTimeout(25_000);
  await shot(page, "weekly-order", 0);
  const approve = await page.$$eval('a[href*="/approve/"]', (links) => links.map((link) => (link as HTMLAnchorElement).href));

  await open(page, "/buyer/mandate");
  await shot(page, "limits");

  await open(page, "/buyer/plan");
  const input = page.locator("input, textarea").first();
  await input.fill("A wedding for 80 guests on Saturday");
  await input.press("Enter");
  await page.waitForTimeout(30_000);
  await shot(page, "event-menus", 0);

  await open(page, "/valio");
  await shot(page, "valio");
  await open(page, "/valio/demand");
  await shot(page, "valio-demand");
  await open(page, "/security");
  await shot(page, "security");

  if (approve[0]) {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, storageState: await desk.storageState() });
    const handset = await phone.newPage();
    await handset.goto(`${approve[0]}${approve[0].includes("?") ? "&" : "?"}tour=off`, { waitUntil: "networkidle" });
    await shot(handset, "phone-approval");
  } else {
    console.warn("No order waited for approval; phone-approval.jpg not captured.");
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
