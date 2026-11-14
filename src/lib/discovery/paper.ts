import { readFileSync } from "node:fs";
import path from "node:path";

/** The paper's source. Its numbers are generated blocks (`npm run evidence`); the prose is written by hand. */
export const PAPER_FILE = path.join("docs", "paper.md");

/**
 * docs/paper.md as written. Node only. The /paper page is prerendered at build time, when the repo is on disk, and
 * `npm run evidence` writes public/paper.md and public/llms-full.txt from it; the runtime image does not need docs/.
 */
export function readPaper(root = process.cwd()): string {
  return readFileSync(path.join(root, PAPER_FILE), "utf8");
}

/** The generated-block markers, which mean nothing to a reader. */
export function withoutMarkers(markdown: string): string {
  return markdown.replace(/^<!-- (BEGIN|END):evidence:[\w-]+ -->\n/gm, "");
}

/** A link target in docs/paper.md, read from the repo root: "../src/lib/x.ts" is "src/lib/x.ts", "judging.md" is "docs/judging.md". */
export function repoPath(target: string): string {
  return path.posix.normalize(path.posix.join("docs", decodeURI(target)));
}

export type LinkTarget = { kind: "web"; href: string } | { kind: "site"; href: string } | { kind: "anchor"; href: string } | { kind: "repo"; path: string };

/** What a Markdown link in the paper points at: the web, a page of this site, a heading, or a file in the repo. */
export function linkTarget(target: string): LinkTarget {
  if (/^[a-z]+:/i.test(target)) return { kind: "web", href: target };
  if (target.startsWith("/")) return { kind: "site", href: target };
  if (target.startsWith("#")) return { kind: "anchor", href: target };
  const [file] = target.split("#");
  return { kind: "repo", path: repoPath(file) };
}

/**
 * The paper as plain text for an agent: block markers removed, site links made absolute and repo links written as
 * the file's path in the repo, so nothing points at a relative address the reader cannot open.
 */
export function paperAsText(markdown: string, origin: string): string {
  return withoutMarkers(markdown).replace(/\[((?:[^\]`]|`[^`]*`)+)\]\(([^)\s]+)\)/g, (_, label: string, target: string) => {
    const where = linkTarget(target);
    switch (where.kind) {
      case "web":
        return `${label} (${where.href})`;
      case "site":
        return `${label} (${origin}${where.href})`;
      case "anchor":
        return label;
      case "repo":
        return label.includes(where.path) ? label : `${label} (\`${where.path}\`)`;
    }
  });
}
