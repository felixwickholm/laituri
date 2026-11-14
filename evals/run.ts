/**
 * Runs the evaluation suites in process, without a server.
 * Usage: npm run eval [-- --live] [-- --suite <id>] [-- --json]
 */
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prepareEnvironment, runSuite, suiteTable, summaryLine, type Mode, type Report, type Suite } from "./harness";

interface Options {
  mode: Mode;
  suite?: string;
  json: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { mode: "recorded", json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--live") options.mode = "live";
    else if (arg === "--json") options.json = true;
    else if (arg === "--suite") options.suite = argv[++i];
    else if (arg.startsWith("--suite=")) options.suite = arg.slice("--suite=".length);
    else throw new Error(`Unknown option ${arg}. Use --live, --suite <id> or --json.`);
  }
  return options;
}

/** Imported after the environment is set, so application modules read the eval settings. */
async function loadSuites(): Promise<{ suites: Suite[]; reset: () => Promise<void> }> {
  const [{ scenariosSuite }, { guardrailsSuite }, { trustSuite }, { opennessSuite }, { resetState }] = await Promise.all([
    import("./suites/scenarios"),
    import("./suites/guardrails"),
    import("./suites/trust"),
    import("./suites/openness"),
    import("./support/flow"),
  ]);
  return { suites: [scenariosSuite, guardrailsSuite, trustSuite, opennessSuite], reset: resetState };
}

function reportFile(mode: Mode): string {
  return path.join("evals", mode === "live" ? "report-live.json" : "report.json");
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = prepareEnvironment(options.mode);
  try {
    const { suites, reset } = await loadSuites();
    const selected = suites.filter((suite) => !options.suite || suite.id === options.suite);
    if (selected.length === 0) throw new Error(`No suite called ${options.suite}. Suites: ${suites.map((s) => s.id).join(", ")}.`);
    if (options.mode === "live") selected.splice(0, selected.length, ...selected.filter((s) => s.liveAll || s.cases.some((c) => c.live)));

    const report: Report = { generatedAt: new Date().toISOString(), mode: options.mode, suites: [] };
    for (const suite of selected) report.suites.push(await runSuite(suite, options.mode, reset));

    // A filtered run is a partial picture, so only a full run replaces the committed report.
    if (!options.suite) writeFileSync(reportFile(options.mode), `${JSON.stringify(report, null, 2)}\n`);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      for (const suite of report.suites) console.log(`\n${suiteTable(suite)}`);
      console.log(`\nSummary (${options.mode})`);
      for (const suite of report.suites) console.log(summaryLine(suite));
      if (!options.suite) console.log(`\nReport: ${reportFile(options.mode)}`);
    }
    return report.suites.every((suite) => suite.met) ? 0 : 1;
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);
