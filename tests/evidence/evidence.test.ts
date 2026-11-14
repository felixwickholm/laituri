import "../store/temp-data-dir";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.VALIO_MODE = "recorded";

const { evidence, FACTS } = await import("@/lib/evidence");
const { staleBlocks } = await import("@/lib/evidence/files");
const { TOOLS } = await import("@/lib/mcp/tools");
const { RuleId } = await import("@/lib/contracts/policy");
const { openApiDocument } = await import("@/lib/openapi/document");
const { buyerIds } = await import("@/lib/mandate/defaults");
const { SEED_REQUESTS } = await import("@/lib/seed/plan");

const ROOT = process.cwd();
/** Set by `npm run evidence` while it measures the tests: the blocks are about to be rewritten. */
const generating = process.env.LAITURI_EVIDENCE_GENERATING === "1";
const e = evidence();

const OFFICIAL = [
  ["Working end-to-end demo", 30],
  ["Solving the problem and user need", 20],
  ["Autonomy and controls", 20],
  ["Robustness to exception situations", 15],
  ["Openness and credible path toward production", 15],
] as const;

const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const scripts = Object.keys((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts);

function allChecks() {
  return [
    ...e.criteria.flatMap((c) => c.check),
    ...[...e.core, ...e.optional, ...e.problems, ...e.privacy].flatMap((r) => r.check),
    ...e.scenarios.flatMap((s) => s.check),
  ];
}

function allPaths(): string[] {
  return [
    ...e.criteria.flatMap((c) => c.where),
    ...[...e.core, ...e.optional, ...e.problems, ...e.privacy].flatMap((r) => r.where),
    ...e.scenarios.flatMap((s) => s.where),
    ...[...e.simulated, ...e.notBuilt].flatMap((a) => a.where),
    ...e.production.flatMap((p) => p.where),
    ...allChecks().filter((c) => c.kind === "test").map((c) => c.value),
  ];
}

/** The App Router file that serves a URL path, if any. */
function routeFile(url: string): string | undefined {
  const pathname = new URL(url, "http://localhost").pathname;
  const dir = path.join(ROOT, "src", "app", ...pathname.split("/").filter(Boolean));
  return ["page.tsx", "route.ts"].map((name) => path.join(dir, name)).find((file) => existsSync(file));
}

function markdownFiles(): string[] {
  const docs = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? docs(path.join(dir, entry.name)) : entry.name.endsWith(".md") ? [path.join(dir, entry.name)] : [],
    );
  return ["README.md", ...(existsSync(path.join(ROOT, "AGENTS.md")) ? ["AGENTS.md"] : []), ...docs("docs")];
}

describe("evidence source", () => {
  it("names the five official criteria with their exact names and weights", () => {
    expect(e.criteria.map((c) => [c.name, c.weight])).toEqual(OFFICIAL.map(([name, weight]) => [name, weight]));
    expect(e.criteria.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });

  it("states a claim, built items, code, a check, a measurement and a limit for every criterion", () => {
    for (const c of e.criteria) {
      expect(c.claim.length, c.name).toBeGreaterThan(20);
      expect(c.built.length, c.name).toBeGreaterThan(0);
      expect(c.where.length, c.name).toBeGreaterThan(0);
      expect(c.check.length, c.name).toBeGreaterThan(0);
      expect(c.measured.length, c.name).toBeGreaterThan(0);
      expect(c.limit.length, c.name).toBeGreaterThan(10);
    }
  });

  it("covers the brief's three core requirements, three optional directions, four problems and six scenarios", () => {
    expect([e.core.length, e.optional.length, e.problems.length, e.scenarios.length]).toEqual([3, 3, 4, 6]);
  });

  it("refers only to repo paths that exist", () => {
    const missing = allPaths().filter((p) => !existsSync(path.join(ROOT, p)));
    expect(missing).toEqual([]);
  });

  it("refers only to eval cases that exist in evals/report.json", () => {
    const ids = allChecks().filter((c) => c.kind === "eval").map((c) => c.value);
    expect(ids.filter((id) => !FACTS.evals.caseIds.includes(id))).toEqual([]);
  });

  it("refers only to URL paths the app serves", () => {
    const urls = [...allChecks().filter((c) => c.kind === "url").map((c) => c.value), ...e.links.map((l) => l.href)];
    expect(urls.filter((url) => !routeFile(url))).toEqual([]);
  });

  it("names only commands that exist", () => {
    for (const check of allChecks().filter((c) => c.kind === "command")) {
      const npm = check.value.match(/^npm run ([\w:-]+)/);
      const tsx = check.value.match(/^npx tsx (\S+)/);
      if (npm) expect(scripts, check.value).toContain(npm[1]);
      else if (tsx) expect(existsSync(path.join(ROOT, tsx[1])), check.value).toBe(true);
      else throw new Error(`Unknown kind of command: ${check.value}`);
    }
  });
});

describe("generated facts", () => {
  it("match evals/report.json", () => {
    const report = JSON.parse(read("evals/report.json")) as { suites: { id: string; passed: number; total: number; cases: { id: string }[] }[] };
    expect(FACTS.evals.suites.map((s) => [s.id, s.passed, s.total])).toEqual(report.suites.map((s) => [s.id, s.passed, s.total]));
    expect(FACTS.evals.caseIds).toEqual(report.suites.flatMap((s) => s.cases.map((c) => c.id)));
  });

  it("match the code they count", () => {
    const doc = openApiDocument("http://localhost") as { paths: Record<string, Record<string, unknown>> };
    expect(FACTS.toolNames).toEqual(TOOLS.map((tool) => tool.name));
    expect(FACTS.mcpTools).toBe(TOOLS.length);
    expect(FACTS.ruleIds).toEqual([...RuleId.options]);
    expect(FACTS.mandateRules).toBe(RuleId.options.length);
    expect(FACTS.restOperations).toBe(Object.values(doc.paths).reduce((sum, item) => sum + Object.keys(item).length, 0));
    expect(FACTS.restPaths).toBe(Object.keys(doc.paths).length);
    expect(FACTS.demoBuyers).toBe(buyerIds().length);
    expect(FACTS.seededRequests).toBe(SEED_REQUESTS.length);
  });
});

describe("Markdown kept in sync", () => {
  it("README.md and docs/ hold the blocks the evidence source renders now (run npm run evidence)", () => {
    // While `npm run evidence` measures the tests, the blocks are about to be rewritten; the count must stay the same.
    if (generating) return;
    expect(staleBlocks(ROOT)).toEqual([]);
  });

  it("names only npm scripts that exist", () => {
    for (const file of markdownFiles()) {
      for (const match of read(file).matchAll(/npm run ([\w:-]+)/g)) expect(scripts, `${file}: ${match[0]}`).toContain(match[1]);
    }
  });

  it("links only to repo files that exist", () => {
    const missing: string[] = [];
    for (const file of markdownFiles()) {
      for (const match of read(file).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        const target = decodeURI(match[1]);
        if (/^[a-z]+:/i.test(target) || target.startsWith("/")) continue;
        // Images in docs/images are added at release.
        if (target.startsWith("docs/images/")) continue;
        if (!existsSync(path.join(ROOT, path.dirname(file), target))) missing.push(`${file}: ${target}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("lists every MCP tool in docs/architecture.md", () => {
    const architecture = read("docs/architecture.md");
    for (const tool of TOOLS) expect(architecture).toContain(`\`${tool.name}\``);
  });
});

describe("README.md stays short and leads with what matters", () => {
  const readme = read("README.md");

  it("stays under 15,000 bytes; the detail lives in docs/", () => {
    expect(Buffer.byteLength(readme)).toBeLessThan(15_000);
  });

  it("holds the agreed sections in order", () => {
    const headings = [...readme.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual([
      "See it in 2 minutes",
      "How each judging criterion is met",
      "What makes it different",
      "What stays private",
      "Quickstart",
      "Eval results",
      "Simulated, assumed and not built",
      "Read more",
      "Licence",
    ]);
  });

  it("names the live demo and leads its differences with the signed request check", () => {
    expect(readme).toContain(e.live);
    const different = readme.slice(readme.indexOf("## What makes it different"));
    expect(different.split("\n").find((line) => line.startsWith("- "))).toMatch(/checks the offer against the buyer's own words, and signs that check/);
  });

  it("links every docs page it moved detail to", () => {
    for (const page of ["docs/judging.md", "docs/trust-protocol.md", "docs/mandates.md", "docs/architecture.md", "docs/production.md", "docs/evals.md"]) {
      expect(readme).toContain(`](${page})`);
    }
  });
});
