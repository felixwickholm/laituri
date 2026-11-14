import type { Facts } from "./types";
import raw from "./facts.json";

/** Written by `npm run evidence` (scripts/evidence.ts). Edit the code, not this file. */
export const FACTS: Facts = raw;

type Suite = Facts["evals"]["suites"][number];

export function suite(facts: Facts, id: string): Suite {
  const found = facts.evals.suites.find((item) => item.id === id);
  if (!found) throw new Error(`evals/report.json has no suite ${id}.`);
  return found;
}

/** "Guardrails 20/20 (bar 100%)" */
export function suiteLine(facts: Facts, id: string): string {
  const item = suite(facts, id);
  return `${item.name} eval suite: ${item.passed}/${item.total} cases pass (bar ${item.bar})`;
}

export function testsLine(facts: Facts): string {
  return `Unit and integration tests: ${facts.tests.passed}/${facts.tests.total} pass in ${facts.tests.files} files`;
}
