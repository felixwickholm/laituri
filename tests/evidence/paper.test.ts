import "../store/temp-data-dir";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.VALIO_MODE = "recorded";

const { evidence } = await import("@/lib/evidence");
const { BLOCK_FILES } = await import("@/lib/evidence/files");
const { paperJsonLd } = await import("@/lib/evidence/paper-ld");
const { paperAsText, readPaper, withoutMarkers } = await import("@/lib/discovery/paper");
const { renderPaper, slug } = await import("@/app/paper/markdown");

const paper = readPaper();
const e = evidence();

/** The paper with every generated block, code span, fenced block, link target, autolink and quotation removed. */
function handWritten(markdown: string): string {
  return markdown
    .replace(/<!-- BEGIN:evidence:([\w-]+) -->[\s\S]*?<!-- END:evidence:\1 -->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/<https?:[^>]+>/g, "")
    .replace(/^>.*$/gm, "")
    .replace(/^\s*\d+\.\s/gm, "");
}

/** Numbers that are names, not counts: standards, the event and its year. */
const NAMES = /Junction 2026|OpenAPI 3\.1|OAuth 2\.1|ES256|SHA-256|P-256|RFC \d{4}|GS1/g;

describe("docs/paper.md", () => {
  it("holds every block registered for it, each between its markers", () => {
    for (const name of BLOCK_FILES["docs/paper.md"]) {
      expect(paper, name).toContain(`<!-- BEGIN:evidence:${name} -->`);
      expect(paper, name).toContain(`<!-- END:evidence:${name} -->`);
    }
  });

  it("has the sections a judge looks for, in order", () => {
    const h2 = [...paper.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    const wanted = [
      "Abstract",
      "The problem, in the brief's words",
      "The design",
      "Measured numbers",
      "Each judging criterion",
      "The core requirements",
      "The example scenarios",
      "The insight problems",
      "Security model",
      "What is simulated and assumed",
      "Path to production",
      "How to evaluate this entry in five minutes",
    ];
    expect(h2.filter((heading) => wanted.includes(heading))).toEqual(wanted);
  });

  it("types no number by hand: every count comes from a generated block", () => {
    const digits = handWritten(paper).replace(NAMES, "").match(/.{0,30}\d.{0,30}/g) ?? [];
    expect(digits).toEqual([]);
  });

  it("states the five criteria with their weights and a limit each", () => {
    for (const c of e.criteria) {
      expect(paper).toContain(`### ${c.name} (${c.weight}%)`);
      expect(paper).toContain(c.limit);
    }
  });

  it("renders to headings the page's contents can link to", () => {
    const { headings } = renderPaper(paper);
    const h2 = headings.filter((h) => h.depth === 2);
    expect(h2.map((h) => h.id)).toEqual([...paper.matchAll(/^## (.+)$/gm)].map((m) => slug(m[1])));
    expect(new Set(headings.map((h) => h.id)).size).toBe(headings.length);
  });

  it("reads outside the repo without a relative link", () => {
    const text = paperAsText(paper, "https://laituri.example");
    expect(text).not.toMatch(/\]\((?!https?:)[^)]*\)/);
    expect(withoutMarkers(text)).not.toContain("<!-- BEGIN:evidence");
    expect(text).toContain("`src/lib/policy/evaluate.ts`");
  });

  it("publishes the same reviewer questions in its FAQ data as on the page", () => {
    const ld = paperJsonLd(e, "x");
    const faq = ld["@graph"].find((node) => node["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(e.questions.map((q) => q.question));
    for (const q of e.questions) {
      expect(paper).toContain(`### ${q.question}`);
      expect(paper).toContain(q.answer);
    }
  });

  it("is linked from the README, AGENTS.md and docs/judging.md", () => {
    const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
    expect(read("README.md")).toContain("](docs/paper.md)");
    expect(read("AGENTS.md")).toContain("docs/paper.md");
    expect(read("docs/judging.md")).toContain("](paper.md)");
  });
});
