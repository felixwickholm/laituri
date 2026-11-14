import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evidence } from "./index";
import { renderBlock } from "./markdown";

/** Which generated blocks each Markdown file holds. Node only: used by scripts/evidence.ts and the tests. */
export const BLOCK_FILES: Record<string, string[]> = {
  "README.md": ["numbers", "criteria", "privacy", "tools", "evals", "scenarios", "simulated", "production"],
  "docs/judging.md": ["judging"],
  "docs/evals.md": ["evals", "cases"],
};

interface ReportCase {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
}

interface Report {
  suites: { id: string; name: string; cases: ReportCase[] }[];
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/** Every eval case with what it expects and whether it passed, from evals/report.json. The run's own evidence text is left out: it can vary in order between runs. */
export function casesTable(root: string): string {
  const report = JSON.parse(readFileSync(path.join(root, "evals", "report.json"), "utf8")) as Report;
  return report.suites
    .map((item) =>
      [
        `### ${item.name} (\`${item.id}\`)`,
        "",
        "| Id | Case | Expected | Result |",
        "|---|---|---|---|",
        ...item.cases.map((c) => `| ${c.id} | ${cell(c.name)} | ${cell(c.expected)} | ${c.pass ? "pass" : "FAIL"} |`),
      ].join("\n"),
    )
    .join("\n\n");
}

function render(root: string, name: string): string {
  return name === "cases" ? casesTable(root) : renderBlock(name, evidence());
}

const begin = (name: string) => `<!-- BEGIN:evidence:${name} -->`;
const end = (name: string) => `<!-- END:evidence:${name} -->`;

/** The text between one block's markers, or undefined when the markers are missing. */
export function readBlock(text: string, name: string): string | undefined {
  const start = text.indexOf(begin(name));
  const stop = text.indexOf(end(name));
  if (start < 0 || stop < start) return undefined;
  return text.slice(start + begin(name).length, stop).trim();
}

export function replaceBlock(text: string, name: string, content: string): string {
  const start = text.indexOf(begin(name));
  const stop = text.indexOf(end(name));
  if (start < 0 || stop < start) throw new Error(`The markers for block ${name} are missing.`);
  return `${text.slice(0, start)}${begin(name)}\n${content}\n${text.slice(stop)}`;
}

/** Blocks whose text differs from what the evidence source renders now, as "file#block". */
export function staleBlocks(root: string): string[] {
  const stale: string[] = [];
  for (const [file, names] of Object.entries(BLOCK_FILES)) {
    const text = readFileSync(path.join(root, file), "utf8");
    for (const name of names) {
      if (readBlock(text, name) !== render(root, name).trim()) stale.push(`${file}#${name}`);
    }
  }
  return stale;
}

/** Rewrites every block; returns the files that changed. */
export function writeBlocks(root: string): string[] {
  const changed: string[] = [];
  for (const [file, names] of Object.entries(BLOCK_FILES)) {
    const full = path.join(root, file);
    const before = readFileSync(full, "utf8");
    let text = before;
    for (const name of names) text = replaceBlock(text, name, render(root, name));
    if (text !== before) {
      writeFileSync(full, text);
      changed.push(file);
    }
  }
  return changed;
}
