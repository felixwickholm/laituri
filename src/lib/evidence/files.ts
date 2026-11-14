import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { llmsFullText } from "@/lib/discovery/llms-full";
import { paperAsText, readPaper } from "@/lib/discovery/paper";
import { evidence, LIVE_URL } from "./index";
import { renderBlock } from "./markdown";

/** Which generated blocks each Markdown file holds. Node only: used by scripts/evidence.ts and the tests. */
export const BLOCK_FILES: Record<string, string[]> = {
  "README.md": ["numbers", "criteria", "privacy-brief", "evals", "simulated"],
  "docs/judging.md": ["judging"],
  "docs/evals.md": ["evals", "cases"],
  "docs/architecture.md": ["tools"],
  "docs/production.md": ["production"],
  "docs/paper.md": [
    "paper-abstract",
    "numbers",
    "paper-criteria",
    "core",
    "scenarios",
    "problems",
    "optional",
    "threats",
    "evals",
    "simulated-full",
    "production",
    "questions",
    "five-minutes",
  ],
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

/** Links in a block are relative to the Markdown file that holds it. */
function baseOf(file: string): string {
  const depth = path.dirname(file) === "." ? 0 : path.dirname(file).split("/").length;
  return "../".repeat(depth);
}

function render(root: string, file: string, name: string): string {
  return name === "cases" ? casesTable(root) : renderBlock(name, evidence(), baseOf(file));
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

/**
 * Files served as they are from public/, written from docs/paper.md after its blocks: the paper as Markdown and the
 * whole picture for an AI in one fetch. Links in them name the live demo.
 */
export const PUBLIC_FILES: Record<string, (root: string) => string> = {
  "public/paper.md": (root) => paperAsText(readPaper(root), LIVE_URL),
  "public/llms-full.txt": (root) => llmsFullText(LIVE_URL, readPaper(root)),
};

function readOr(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

/** Blocks whose text differs from what the evidence source renders now, as "file#block". */
export function staleBlocks(root: string): string[] {
  const stale: string[] = [];
  for (const [file, names] of Object.entries(BLOCK_FILES)) {
    const text = readFileSync(path.join(root, file), "utf8");
    for (const name of names) {
      if (readBlock(text, name) !== render(root, file, name).trim()) stale.push(`${file}#${name}`);
    }
  }
  for (const [file, make] of Object.entries(PUBLIC_FILES)) if (readOr(path.join(root, file)) !== make(root)) stale.push(file);
  return stale;
}

/** Rewrites every block; returns the files that changed. */
export function writeBlocks(root: string): string[] {
  const changed: string[] = [];
  for (const [file, names] of Object.entries(BLOCK_FILES)) {
    const full = path.join(root, file);
    const before = readFileSync(full, "utf8");
    let text = before;
    for (const name of names) text = replaceBlock(text, name, render(root, file, name));
    if (text !== before) {
      writeFileSync(full, text);
      changed.push(file);
    }
  }
  for (const [file, make] of Object.entries(PUBLIC_FILES)) {
    const full = path.join(root, file);
    const text = make(root);
    if (readOr(full) !== text) {
      writeFileSync(full, text);
      changed.push(file);
    }
  }
  return changed;
}
