import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type Mode = "recorded" | "live";

/** The pinned clock of the recorded fixtures: Saturday morning, delivery possible on Monday 2026-11-16. */
export const PINNED_NOW = "2026-11-14T09:00:00+02:00";

export interface Verdict {
  pass: boolean;
  evidence: string;
  actual: string;
}

export interface EvalCase {
  id: string;
  name: string;
  expected: string;
  /** Part of the smoke subset that runs against the live wholesaler API. */
  live?: boolean;
  run(): Promise<Verdict>;
}

export interface Suite {
  id: string;
  name: string;
  /** Share of cases that must pass, 0 to 1. */
  bar: number;
  /** Every case of the suite runs in live mode. */
  liveAll?: boolean;
  cases: EvalCase[];
}

export interface CaseReport {
  id: string;
  name: string;
  pass: boolean;
  evidence: string;
  expected: string;
  actual: string;
}

export interface SuiteReport {
  id: string;
  name: string;
  passed: number;
  total: number;
  bar: string;
  met: boolean;
  cases: CaseReport[];
}

export interface Report {
  generatedAt: string;
  mode: Mode;
  suites: SuiteReport[];
}

/**
 * Must run before any application module loads: the clock, upstream mode, catalogue and data folder
 * are read from the environment.
 */
export function prepareEnvironment(mode: Mode): string {
  const dataDir = mkdtempSync(path.join(tmpdir(), "laituri-eval-"));
  process.env.LAITURI_DATA_DIR = dataDir;
  process.env.LAITURI_DEMO_STEP_MS = "0";
  process.env.LAITURI_SEED = "off";
  if (mode === "recorded") {
    // Evals never call paid services: the speech route answers voice_not_configured, as documented.
    delete process.env.ELEVENLABS_API_KEY;
    process.env.VALIO_MODE = "recorded";
    process.env.LAITURI_NOW = PINNED_NOW;
    process.env.LAITURI_CATALOG = path.resolve("fixtures", "upstream", "catalog.json");
    return dataDir;
  }
  if (existsSync(".env")) process.loadEnvFile(".env");
  delete process.env.ELEVENLABS_API_KEY;
  process.env.VALIO_MODE = "live";
  delete process.env.LAITURI_NOW;
  delete process.env.LAITURI_CATALOG;
  if (!process.env.VALIO_API_KEY) throw new Error("Live mode needs VALIO_API_KEY in .env.");
  if (!existsSync(path.join(".data", "catalog.json"))) throw new Error("Live mode needs .data/catalog.json. Run: npm run setup");
  return dataDir;
}

export function barText(bar: number): string {
  return bar >= 1 ? "100%" : `>=${Math.round(bar * 100)}%`;
}

/** Runs each case on a clean state. A thrown error is a failed case, never a crashed run. */
export async function runSuite(suite: Suite, mode: Mode, reset: () => Promise<void>): Promise<SuiteReport> {
  const selected = mode === "live" && !suite.liveAll ? suite.cases.filter((c) => c.live) : suite.cases;
  const cases: CaseReport[] = [];
  for (const evalCase of selected) {
    let verdict: Verdict;
    try {
      await reset();
      verdict = await evalCase.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      verdict = { pass: false, evidence: `Error: ${message}`, actual: "error" };
    }
    cases.push({ id: evalCase.id, name: evalCase.name, pass: verdict.pass, evidence: verdict.evidence, expected: evalCase.expected, actual: verdict.actual });
  }
  const passed = cases.filter((c) => c.pass).length;
  const met = cases.length > 0 && passed / cases.length >= suite.bar;
  return { id: suite.id, name: suite.name, passed, total: cases.length, bar: barText(suite.bar), met, cases };
}

function cell(text: string, width: number): string {
  const flat = text.replace(/\s+/g, " ");
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat.padEnd(width);
}

export function suiteTable(suite: SuiteReport): string {
  const rows = suite.cases.map((c) => `  ${cell(c.id, 4)} ${cell(c.name, 40)} ${c.pass ? "PASS" : "FAIL"}  ${cell(c.evidence, 110).trimEnd()}`);
  return [`${suite.name} (${suite.id})`, ...rows].join("\n");
}

export function summaryLine(suite: SuiteReport): string {
  const rate = suite.total ? (100 * suite.passed) / suite.total : 0;
  const verdict = suite.met ? "met" : "MISSED";
  return `  ${cell(suite.name, 12)} ${`${suite.passed}/${suite.total}`.padStart(6)}  ${rate.toFixed(1).padStart(5)}%  bar ${suite.bar.padEnd(5)}  ${verdict}`;
}
