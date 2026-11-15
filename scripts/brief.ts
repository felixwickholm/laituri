/**
 * Builds the brief, "Laituri: the brief and the build", from docs/brief/brief.html: fills its {{placeholders}} from
 * src/lib/evidence (numbers measured by `npm run evidence`), writes public/brief.html with its assets in
 * public/brief-assets, and prints public/brief.pdf as a tagged PDF with an outline. Served at /brief and /brief.pdf.
 *
 *   npx tsx scripts/brief.ts
 *
 * Needs Google Chrome, or a Playwright Chromium (CHROME_PATH overrides). Screenshots come from docs/images
 * (scripts/screens.ts).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { DEFAULT_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL } from "@/lib/agent/llm/engine";
import { toolSpecs } from "@/lib/agent/llm/tools";
import { evidence } from "@/lib/evidence";
import { SUITE_PROVES } from "@/lib/evidence/markdown";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "docs", "brief");
const PUBLIC = path.join(ROOT, "public");
const ASSETS = path.join(PUBLIC, "brief-assets");
const SHOTS = ["today", "weekly-order", "limits", "event-menus", "phone-approval", "valio", "valio-demand", "security"];

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function values(): Record<string, string> {
  const e = evidence();
  const f = e.facts;
  const tools = toolSpecs().map((tool) => tool.name);
  const criteriaRows = e.criteria
    .map((c) => {
      const check = c.check.slice(0, 2).map((item) => (item.kind === "eval" ? `eval ${item.value}` : `<code>${escape(item.value)}</code>`)).join("; ");
      return `        <tr><td><b>${escape(c.name)}</b> (${c.weight}%)</td><td>${escape(c.built[0] ?? c.claim)}</td><td>${check}</td></tr>`;
    })
    .join("\n");
  const suiteRows = f.evals.suites
    .map((s) => `        <tr><td><b>${escape(s.name)}</b></td><td>${s.passed}/${s.total}</td><td>${escape(s.bar)}</td><td>${escape(SUITE_PROVES[s.id] ?? "")}</td></tr>`)
    .join("\n");
  const threatRows = e.threats
    .slice(0, 5)
    .map((t) => `        <tr><td>${escape(t.threat)}</td></tr>`)
    .join("\n");
  const pick = ["Orders", "Keys", "Agent identity", "State", "Buyer agent"];
  const simulatedItems = e.simulated
    .filter((item) => pick.includes(item.topic))
    .map((item) => `        <li><b>${escape(item.topic)}:</b> ${escape(item.brief)}.</li>`)
    .join("\n");
  const u = f.upstream;
  return {
    pitch: escape(e.pitch),
    live: e.live,
    liveHost: new URL(e.live).host,
    testsLine: `${f.tests.passed}/${f.tests.total} tests pass.`,
    evalsLine: `${f.evals.passed}/${f.evals.total} eval cases pass.`,
    testsPassed: String(f.tests.passed),
    testsTotal: String(f.tests.total),
    testsFiles: String(f.tests.files),
    evalsPassed: String(f.evals.passed),
    evalsTotal: String(f.evals.total),
    suiteShort: f.evals.suites.map((s) => `${s.name} ${s.passed}/${s.total}`).join(", "),
    mcpTools: String(f.mcpTools),
    restOperations: String(f.restOperations),
    restPaths: String(f.restPaths),
    mandateRules: String(f.mandateRules),
    signingKeys: String(f.signingKeys.length),
    buyerNames: escape(f.buyerNames.join(", ")),
    catalogueSize: u.catalogueSize.toLocaleString("en-GB"),
    upstreamLine: `a ${u.basketLines}-line weekly order asks about ${u.basketProductsAsked} of ${u.catalogueSize.toLocaleString("en-GB")} products in ${u.basketCalls} requests`,
    chainText: `Gemini (${DEFAULT_GEMINI_MODEL}), then Claude (${DEFAULT_CLAUDE_MODEL}), then a rule-based scripted agent`,
    agentToolCount: String(tools.length),
    agentTools: tools.join(", "),
    criteriaRows,
    suiteRows,
    threatRows,
    threatCount: String(e.threats.length),
    simulatedItems,
    notBuilt: escape(e.notBuilt.map((item) => item.topic).join(", ")),
  };
}

function fill(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in data)) throw new Error(`docs/brief/brief.html: no value for ${match}`);
    return data[key];
  });
}

async function main() {
  mkdirSync(path.join(ASSETS, "img"), { recursive: true });
  mkdirSync(path.join(ASSETS, "fonts"), { recursive: true });
  for (const name of SHOTS) copyFileSync(path.join(ROOT, "docs", "images", `${name}.jpg`), path.join(ASSETS, "img", `${name}.jpg`));
  for (const font of ["BarlowCondensed-700", "BarlowCondensed-800", "Figtree-400", "Figtree-600", "Figtree-700"]) {
    copyFileSync(path.join(SOURCE, "fonts", `${font}.woff2`), path.join(ASSETS, "fonts", `${font}.woff2`));
  }
  copyFileSync(path.join(PUBLIC, "brand", "lockup-light.svg"), path.join(ASSETS, "lockup-light.svg"));

  const html = fill(readFileSync(path.join(SOURCE, "brief.html"), "utf8"), values());
  const out = path.join(PUBLIC, "brief.html");
  writeFileSync(out, html);

  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(out).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(PUBLIC, "brief.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
  const pages = await page.evaluate(() => document.querySelectorAll("section.page").length);
  await browser.close();
  console.log(`public/brief.html and public/brief.pdf written (${pages} pages).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
