import { TOOLS } from "@/lib/mcp/tools";
import { OPERATIONS } from "@/lib/openapi/registry";
import { suite, testsLine } from "./facts";
import { evidence } from "./index";
import type { Assumption, Check, Evidence, Facts, Requirement } from "./types";

/** Markdown blocks generated from the evidence source. `base` is the path from the Markdown file to the repo root. */

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function pathLink(path: string, base = ""): string {
  return `[\`${path}\`](${base}${encodeURI(path)})`;
}

export function checkText(check: Check): string {
  switch (check.kind) {
    case "command":
      return `\`${check.value}\``;
    case "url":
      return `\`${check.value}\` on the live demo`;
    case "eval":
      return `eval ${check.value}`;
    case "test":
      return `\`${check.value}\``;
  }
}

const STATUS_WORD = { covered: "Covered", partly: "Partly", "not built": "Not built" } as const;

/** One line of the headline numbers. */
export function numbers(f: Facts): string {
  const suites = f.evals.suites.map((item) => `${item.name} ${item.passed}/${item.total}`).join(", ");
  return [
    `Measured by \`npm run evidence\` (numbers in [\`src/lib/evidence/facts.json\`](src/lib/evidence/facts.json)):`,
    "",
    `- ${testsLine(f)}.`,
    `- Eval suites (\`npm run eval\`, recorded data, fixed clock): ${suites}; ${f.evals.passed}/${f.evals.total} cases in all.`,
    `- ${f.mandateRules} mandate rules, ${f.mcpTools} MCP tools, ${f.restOperations} REST operations on ${f.restPaths} paths, ${f.discoveryDocuments} discovery documents, ${f.signingKeys.length} signing keys.`,
    `- ${f.demoBuyers} demo buyers; ${f.seededRequests} seeded requests (${f.seededOrders} of them place an order); recorded answers for ${f.recordedProducts} products.`,
  ].join("\n");
}

export function criteriaTable(e: Evidence, base = ""): string {
  const rows = e.criteria.map((c) => {
    const built = [c.claim, ...c.built.slice(0, 3).map((item) => `• ${item}`)].map(cell).join("<br>");
    const where = c.where.slice(0, 4).map((p) => pathLink(p, base)).join("<br>");
    const proof = [...c.measured.map(cell), `Check: ${c.check.map(checkText).join("; ")}`].join("<br>");
    return `| **${c.name}** (${c.weight}%) | ${built} | ${where} | ${proof} | ${cell(c.limit)} |`;
  });
  return ["| Criterion (weight) | What we built (first items; all in docs/judging.md) | Where in the code | Evidence | Known limit |", "|---|---|---|---|---|", ...rows].join("\n");
}

export function toolsTable(): string {
  const rows = TOOLS.map((tool) => {
    const op = OPERATIONS.find((item) => item.operationId === tool.operationId);
    const rest = op ? `\`${op.method.toUpperCase()} ${op.path}\`` : "";
    return `| \`${tool.name}\` | ${rest} | ${cell(tool.title)} |`;
  });
  return ["| Tool (MCP) | REST | Purpose |", "|---|---|---|", ...rows].join("\n");
}

const SUITE_PROVES: Record<string, string> = {
  scenarios: "Plain-language requests end on the right route (auto, approval, blocked, no order) with the right product, amount and date, and a verified audit trail.",
  guardrails: "Edited, expired, replayed or wrongly signed inputs, forged approvals, injected instructions and races never get past the mandate.",
  trust: "Every signature verifies with the published keys, and any changed, deleted, reordered or cut entry is detected.",
  openness: "The OpenAPI document and MCP tools are complete and callable, discovery documents are served, and an agent can buy from llms.txt alone.",
};

export function evalsTable(f: Facts): string {
  const rows = f.evals.suites.map(
    (item) => `| ${item.name} (\`${item.id}\`) | ${item.passed}/${item.total} | ${item.bar} | ${item.met ? "met" : "missed"} | ${SUITE_PROVES[item.id] ?? ""} |`,
  );
  return [
    "| Suite | Passed | Bar | Result | What it proves |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    `${testsLine(f)} (\`npm test\`).`,
  ].join("\n");
}

export function scenarioTable(e: Evidence, base = ""): string {
  const rows = e.scenarios.map((s) => {
    const where = [...s.where.map((p) => pathLink(p, base)), ...s.check.map(checkText)].join(", ");
    return `| ${cell(s.name)} | ${STATUS_WORD[s.status]} | ${cell(s.note)} | ${where || "None"} |`;
  });
  return ["| Example scenario in the brief | Status | What exists | Where |", "|---|---|---|---|", ...rows].join("\n");
}

function assumptionList(items: Assumption[], base: string): string {
  return items
    .map((item) => {
      const where = item.where.length ? ` (${item.where.map((p) => pathLink(p, base)).join(", ")})` : "";
      return `- **${item.topic}.** ${item.text}${where}`;
    })
    .join("\n");
}

export function simulatedList(e: Evidence, base = ""): string {
  return ["Simulated or assumed:", "", assumptionList(e.simulated, base), "", "Not built:", "", assumptionList(e.notBuilt, base)].join("\n");
}

export function productionList(e: Evidence, base = ""): string {
  return e.production
    .map((step, index) => {
      const where = step.where.length ? ` Builds on ${step.where.map((p) => pathLink(p, base)).join(", ")}.` : "";
      return `${index + 1}. **${step.step}.** ${step.why}${where}`;
    })
    .join("\n");
}

function requirementTable(items: Requirement[], base: string, head: string): string {
  const rows = items.map((r) => {
    const where = r.where.map((p) => pathLink(p, base)).join("<br>");
    return `| ${cell(r.quote)} | ${STATUS_WORD[r.status]} | ${cell(r.answer)} | ${where} | ${r.check.map(checkText).join("; ")} |`;
  });
  return [`| ${head} | Status | Answer | Where | Check |`, "|---|---|---|---|---|", ...rows].join("\n");
}

export function privacyTable(e: Evidence, base = ""): string {
  return requirementTable(e.privacy, base, "Not exposed");
}

/** The long form of the criteria-to-evidence map, for docs/judging.md. */
export function judging(e: Evidence, base = "../"): string {
  const sections = e.criteria.map((c) =>
    [
      `### ${c.name} (${c.weight}%)`,
      "",
      c.claim,
      "",
      "What we built:",
      "",
      ...c.built.map((item) => `- ${item}`),
      "",
      `Where in the code: ${c.where.map((p) => pathLink(p, base)).join(", ")}.`,
      "",
      `How to check: ${c.check.map(checkText).join("; ")}.`,
      "",
      "Measured:",
      "",
      ...c.measured.map((item) => `- ${item}.`),
      "",
      `Known limit: ${c.limit}`,
    ].join("\n"),
  );
  return [
    "## The five criteria",
    "",
    ...sections.flatMap((section) => [section, ""]),
    "## Core requirements",
    "",
    requirementTable(e.core, base, "Brief"),
    "",
    "## Optional directions",
    "",
    requirementTable(e.optional, base, "Brief"),
    "",
    "## Problems the brief asks to tackle",
    "",
    requirementTable(e.problems, base, "Brief"),
    "",
    "## Without exposing real systems, confidential data or the marketplace roadmap",
    "",
    privacyTable(e, base),
    "",
    "## Example scenarios",
    "",
    scenarioTable(e, base),
    "",
    "## Simulated, assumed and not built",
    "",
    simulatedList(e, base),
  ].join("\n");
}

/** Headline numbers for one suite, for prose. */
export function suiteNumbers(f: Facts, id: string): string {
  const item = suite(f, id);
  return `${item.passed}/${item.total}`;
}

/** Every generated block by name. */
export function renderBlock(name: string, e: Evidence = evidence()): string {
  switch (name) {
    case "numbers":
      return numbers(e.facts);
    case "criteria":
      return criteriaTable(e);
    case "tools":
      return toolsTable();
    case "evals":
      return evalsTable(e.facts);
    case "scenarios":
      return scenarioTable(e);
    case "privacy":
      return privacyTable(e);
    case "simulated":
      return simulatedList(e);
    case "production":
      return productionList(e);
    case "judging":
      return judging(e);
    default:
      throw new Error(`No generated block is called ${name}.`);
  }
}
