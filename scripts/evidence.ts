/**
 * Measures the numbers that README.md, docs/, /evidence, /evidence.json and llms.txt quote, writes them to
 * src/lib/evidence/facts.json, and regenerates the marked blocks in the Markdown files from src/lib/evidence.
 *
 * Usage: npm run evidence            run the evals and the tests, then write facts and blocks
 *        npm run evidence -- --quick reuse the test numbers already in facts.json and the existing eval report
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Facts } from "../src/lib/evidence/types";

const ROOT = process.cwd();
const FACTS_FILE = path.join(ROOT, "src", "lib", "evidence", "facts.json");
const REPORT_FILE = path.join(ROOT, "evals", "report.json");
const quick = process.argv.includes("--quick");

// The application modules read these when they load, so they are set before any import below.
process.env.VALIO_MODE = "recorded";
process.env.LAITURI_SEED = "off";
process.env.LAITURI_DATA_DIR = mkdtempSync(path.join(tmpdir(), "laituri-evidence-"));

function run(command: string, args: string[], env: Record<string, string> = {}): void {
  execFileSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
}

interface VitestJson {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
}

/** Runs the whole test suite once. The README check passes while this runs, so the count is the same as `npm test`. */
function measureTests(): Facts["tests"] {
  const dir = mkdtempSync(path.join(tmpdir(), "laituri-vitest-"));
  const out = path.join(dir, "vitest.json");
  try {
    try {
      run("npx", ["vitest", "run", "--reporter=json", `--outputFile=${out}`], { LAITURI_EVIDENCE_GENERATING: "1" });
    } catch {
      // A failing test still writes the report; the failure count is part of the facts.
    }
    const result = JSON.parse(readFileSync(out, "utf8")) as VitestJson;
    for (const file of result.testResults) {
      for (const test of file.assertionResults) if (test.status === "failed") console.error(`FAILED ${path.relative(ROOT, file.name)}: ${test.fullName}`);
    }
    return { files: result.testResults.length, total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface EvalReport {
  generatedAt: string;
  mode: string;
  suites: { id: string; name: string; passed: number; total: number; bar: string; met: boolean; cases: { id: string }[] }[];
}

function readEvals(): Facts["evals"] {
  const report = JSON.parse(readFileSync(REPORT_FILE, "utf8")) as EvalReport;
  const suites = report.suites.map(({ id, name, passed, total, bar, met }) => ({ id, name, passed, total, bar, met }));
  return {
    mode: report.mode,
    generatedAt: report.generatedAt,
    passed: suites.reduce((sum, suite) => sum + suite.passed, 0),
    total: suites.reduce((sum, suite) => sum + suite.total, 0),
    suites,
    caseIds: report.suites.flatMap((suite) => suite.cases.map((c) => c.id)),
  };
}

/** Discovery documents: every route under /.well-known plus /llms.txt. */
function countDiscovery(): number {
  const wellKnown = path.join(ROOT, "src", "app", ".well-known");
  const documents = readdirSync(wellKnown).filter((name) => existsSync(path.join(wellKnown, name, "route.ts")));
  return documents.length + (existsSync(path.join(ROOT, "src", "app", "llms.txt", "route.ts")) ? 1 : 0);
}

async function measureCode(): Promise<Omit<Facts, "tests" | "evals" | "upstream">> {
  const [{ ROLES }, { RuleId }, { TOOLS }, { openApiDocument }, mandate, { SEED_REQUESTS }, { readProductFile, fixtureCatalogPath }] = await Promise.all([
    import("../src/lib/trust"),
    import("../src/lib/contracts/policy"),
    import("../src/lib/mcp/tools"),
    import("../src/lib/openapi/document"),
    import("../src/lib/mandate/defaults"),
    import("../src/lib/seed/plan"),
    import("../src/lib/catalog/load"),
  ]);
  const document = openApiDocument("http://localhost") as { paths: Record<string, Record<string, unknown>> };
  const paths = Object.values(document.paths);
  const ids = mandate.buyerIds();
  return {
    mandateRules: RuleId.options.length,
    ruleIds: [...RuleId.options],
    mcpTools: TOOLS.length,
    toolNames: TOOLS.map((tool) => tool.name),
    restOperations: paths.reduce((sum, item) => sum + Object.keys(item).length, 0),
    restPaths: paths.length,
    discoveryDocuments: countDiscovery(),
    signingKeys: [...ROLES],
    demoBuyers: ids.length,
    buyerNames: ids.map((id) => mandate.buyerParty(id).name),
    seededRequests: SEED_REQUESTS.length,
    seededOrders: SEED_REQUESTS.filter((request) => request.order).length,
    recordedProducts: readProductFile(fixtureCatalogPath()).length,
  };
}

/**
 * Runs Nordic Harbour's 20-line weekly order on the recorded data with an empty cache and counts what reached the
 * wholesaler's price and availability APIs. The full catalogue's size comes from the product files `npm run setup`
 * downloads, when present.
 */
async function measureUpstream(previous: Facts | undefined): Promise<Facts["upstream"]> {
  // Only this measurement runs on the recorded catalogue; the test run started afterwards keeps its own environment.
  const before = process.env.LAITURI_CATALOG;
  process.env.LAITURI_CATALOG = path.join(ROOT, "fixtures", "upstream", "catalog.json");
  try {
    return await weeklyUsage(previous);
  } finally {
    if (before === undefined) delete process.env.LAITURI_CATALOG;
    else process.env.LAITURI_CATALOG = before;
  }
}

async function weeklyUsage(previous: Facts | undefined): Promise<Facts["upstream"]> {
  const [{ buyerAgent, startBasket, toBasket, weeklyRequest }, { weeklyDeliverBy }, { BUYER_IDS }, { UPSTREAM_ID_CAP }, { now }, { readProductFile }] = await Promise.all([
    import("../src/lib/basket"),
    import("../src/lib/basket/weekly"),
    import("../src/lib/mandate/defaults"),
    import("../src/lib/valio/budget"),
    import("../src/lib/clock"),
    import("../src/lib/catalog/load"),
  ]);
  const request = weeklyRequest(BUYER_IDS.nordicHarbour, weeklyDeliverBy(now()));
  const { done } = await startBasket(request, await buyerAgent(BUYER_IDS.nordicHarbour));
  const stored = await done;
  if (!stored) throw new Error("The weekly order did not finish.");
  const { totals } = toBasket(stored);
  const fullCatalogue = path.join(ROOT, ".data", "catalog.json");
  return {
    searchCap: UPSTREAM_ID_CAP.search,
    quoteLineCap: UPSTREAM_ID_CAP.quoteLine,
    basketLines: totals.lines,
    basketCalls: totals.upstreamCalls ?? 0,
    basketProductsAsked: totals.productsAsked ?? 0,
    catalogueSize: existsSync(fullCatalogue) ? readProductFile(fullCatalogue).length : previous?.upstream?.catalogueSize ?? 0,
  };
}

async function main(): Promise<void> {
  const previous = existsSync(FACTS_FILE) ? (JSON.parse(readFileSync(FACTS_FILE, "utf8")) as Facts) : undefined;
  if (!quick) run("npx", ["tsx", "evals/run.ts"]);
  const measured = { evals: readEvals(), ...(await measureCode()), upstream: await measureUpstream(previous) };
  // The test run imports the facts, so a first run needs a file before the test numbers are known.
  const known = previous?.tests ?? { files: 0, total: 0, passed: 0, failed: 0 };
  writeFileSync(FACTS_FILE, `${JSON.stringify({ tests: known, ...measured }, null, 2)}\n`);
  const tests = quick && previous ? previous.tests : measureTests();
  const facts: Facts = { tests, ...measured };
  writeFileSync(FACTS_FILE, `${JSON.stringify(facts, null, 2)}\n`);

  // Imported after the facts are written, so the blocks render from the new numbers.
  const { writeBlocks } = await import("../src/lib/evidence/files");
  const changed = writeBlocks(ROOT);
  console.log(`\nFacts: ${path.relative(ROOT, FACTS_FILE)}`);
  console.log(`Tests ${tests.passed}/${tests.total} in ${tests.files} files; evals ${facts.evals.passed}/${facts.evals.total}.`);
  console.log(changed.length ? `Updated: ${changed.join(", ")}` : "Every generated block was already current.");
  if (tests.failed > 0 || facts.evals.suites.some((suite) => !suite.met)) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  })
  .finally(() => rmSync(process.env.LAITURI_DATA_DIR ?? "", { recursive: true, force: true }));
