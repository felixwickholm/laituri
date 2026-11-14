import { TOOLS } from "@/lib/mcp/tools";
import { OPERATIONS } from "@/lib/openapi/registry";
import { suite, testsLine } from "./facts";
import { evidence } from "./index";
import type { Assumption, Check, Criterion, Evidence, Facts, Requirement } from "./types";

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
export function numbers(f: Facts, base = ""): string {
  const suites = f.evals.suites.map((item) => `${item.name} ${item.passed}/${item.total}`).join(", ");
  return [
    `Measured by \`npm run evidence\` (numbers in [\`src/lib/evidence/facts.json\`](${base}src/lib/evidence/facts.json)):`,
    "",
    `- ${testsLine(f)}.`,
    `- Eval suites (\`npm run eval\`, recorded data, fixed clock): ${suites}; ${f.evals.passed}/${f.evals.total} cases in all.`,
    `- ${f.mandateRules} mandate rules, ${f.mcpTools} MCP tools, ${f.restOperations} REST operations on ${f.restPaths} paths, ${f.discoveryDocuments} discovery documents, ${f.signingKeys.length} signing keys.`,
    `- ${f.demoBuyers} demo buyers; ${f.seededRequests} seeded requests (${f.seededOrders} of them place an order); recorded answers for ${f.recordedProducts} products.`,
  ].join("\n");
}

/** The README's short form: the claim, the first thing built, the first measurement and how to check. The long form is in docs/judging.md. */
export function criteriaTable(e: Evidence): string {
  const rows = e.criteria.map((c) => {
    const built = [c.claim, `• ${c.built[0]}`].map(cell).join("<br>");
    const proof = [cell(c.measured[0]), `Check: ${c.check.slice(0, 2).map(checkText).join("; ")}`].join("<br>");
    return `| **${c.name}** (${c.weight}%) | ${built} | ${proof} | ${cell(c.limit)} |`;
  });
  return ["| Criterion (weight) | What we built (all items in docs/judging.md) | Evidence | Known limit |", "|---|---|---|---|", ...rows].join("\n");
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
  openness: "The OpenAPI document and MCP tools are complete and callable, discovery documents are served, and an agent that reads llms.txt over HTTP buys by following its REST flow.",
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

/** The README's short list of what is simulated. Each item in full, with its code, is in docs/judging.md. */
export function simulatedBrief(e: Evidence): string {
  return [
    "Simulated or assumed (each in full, with the code behind it, in [docs/judging.md](docs/judging.md#simulated-assumed-and-not-built)):",
    "",
    ...e.simulated.map((item) => `- **${item.topic}:** ${item.brief}.`),
    "",
    `Not built: ${e.notBuilt.map((item) => item.topic).join(", ")}.`,
  ].join("\n");
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

/** The README's shorter form: the answer, the first file and the checks. Every row in full is in docs/judging.md. */
export function privacyBrief(e: Evidence, base = ""): string {
  const rows = e.privacy.map((r) => `| ${cell(r.quote)} | ${cell(r.answer)} | ${r.where.slice(0, 1).map((p) => pathLink(p, base)).join("")} | ${r.check.map(checkText).join("; ")} |`);
  return ["| Not exposed | Answer | Code | Check |", "|---|---|---|---|", ...rows].join("\n");
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

/** The paper's abstract: five sentences, every number from the facts. */
export function paperAbstract(e: Evidence): string {
  const f = e.facts;
  return [
    `${e.name} is an open front door through which a hotel's or a kitchen's own purchasing agent buys from the food-service wholesaler Valio Aimo over MCP or REST: it searches the catalogue, receives a fixed-price offer signed by the wholesaler, and orders inside a mandate the buyer signed.`,
    `Every order is checked by ${f.mandateRules} named rules in three tiers (the agent orders alone, a named person approves, or the order is refused), and a buyer can let the agent reorder alone what it bought before while a new product waits for a person.`,
    "When stock is short, the order cut-off has passed or delivery would be late, the wholesaler returns signed counter-offers ranked good, better and best, and in a menu plan an ingredient is swapped by its role in the recipe.",
    "Every step is a signed entry in a hash-chained log that the buyer, the wholesaler and any outside agent can verify with the published public keys.",
    `On recorded data with a fixed clock, ${f.evals.passed} of ${f.evals.total} eval cases and ${f.tests.passed} of ${f.tests.total} unit and integration tests pass; orders are simulated, because the challenge's mock API has no order endpoint.`,
  ].join(" ");
}

/** One criterion in the paper: the claim, what was built, the code, how to verify it, what was measured and the limit. */
function paperCriterion(c: Criterion, base: string): string {
  return [
    `### ${c.name} (${c.weight}%)`,
    "",
    c.claim,
    "",
    ...c.built.map((item) => `- ${item}`),
    "",
    `**Code.** ${c.where.map((p) => pathLink(p, base)).join(", ")}.`,
    "",
    `**Verify.** ${c.check.map(checkText).join("; ")}.`,
    "",
    `**Measured.** ${c.measured.join("; ")}.`,
    "",
    `**Known limit.** ${c.limit}`,
  ].join("\n");
}

export function paperCriteria(e: Evidence, base = ""): string {
  return e.criteria.map((c) => paperCriterion(c, base)).join("\n\n");
}

export function threatTable(e: Evidence, base = ""): string {
  const rows = e.threats.map((t) => `| ${cell(t.threat)} | ${cell(t.defence)} | ${t.where.map((p) => pathLink(p, base)).join(", ")} | ${t.check.map(checkText).join(", ")} |`);
  return ["| Threat | Defence | Code | Tried by |", "|---|---|---|---|", ...rows].join("\n");
}

export function questionList(e: Evidence): string {
  return e.questions.map((q) => `### ${q.question}\n\n${q.answer}`).join("\n\n");
}

/** Exact steps for a reviewer with five minutes, against the live demo and a local clone. */
export function fiveMinutes(e: Evidence): string {
  const f = e.facts;
  return [
    `1. Open ${e.live}/buyer?tour=1. The demo walkthrough plays the product: the brief's milk order, a weekly basket of ${f.upstream.basketLines} lines with the reason for every line that waits or stops, a phone approval, the buyer's limits, event planning with Valio recipes, Valio Aimo's side, security and the record.`,
    `2. Run \`curl -s -X POST ${e.live}/api/v1/workspace\`. It returns a private sandbox with one agent key per demo buyer. Then follow ${e.live}/llms.txt: search, quote, read the mandate, order.`,
    `3. Open ${e.live}/api/v1/audit/verify. The server re-checks the hash chain and every signature; ${e.live}/.well-known/jwks.json has the keys to do it yourself.`,
    `4. Open ${e.live}/security. Unusual actions are tried live and each is stopped, flagged and logged.`,
    `5. Open ${e.live}/evidence or ${e.live}/evidence.json. Every criterion with its code, checks, measurements and limit.`,
    `6. In a clone: \`npm install\`, then \`npm run eval\` (recorded data, fixed clock, no key: ${f.evals.passed}/${f.evals.total} cases) and \`npm test\`. One suite: \`npm run eval -- --suite guardrails\`.`,
  ].join("\n");
}

/** Headline numbers for one suite, for prose. */
export function suiteNumbers(f: Facts, id: string): string {
  const item = suite(f, id);
  return `${item.passed}/${item.total}`;
}

/** Every generated block by name. `base` is the path from the Markdown file that holds it to the repo root. */
export function renderBlock(name: string, e: Evidence = evidence(), base = ""): string {
  switch (name) {
    case "numbers":
      return numbers(e.facts, base);
    case "paper-abstract":
      return paperAbstract(e);
    case "paper-criteria":
      return paperCriteria(e, base);
    case "core":
      return requirementTable(e.core, base, "Brief");
    case "optional":
      return requirementTable(e.optional, base, "Brief");
    case "problems":
      return requirementTable(e.problems, base, "Brief");
    case "threats":
      return threatTable(e, base);
    case "questions":
      return questionList(e);
    case "five-minutes":
      return fiveMinutes(e);
    case "simulated-full":
      return simulatedList(e, base);
    case "criteria":
      return criteriaTable(e);
    case "tools":
      return toolsTable();
    case "evals":
      return evalsTable(e.facts);
    case "scenarios":
      return scenarioTable(e, base);
    case "privacy":
      return privacyTable(e, base);
    case "privacy-brief":
      return privacyBrief(e, base);
    case "simulated":
      return simulatedBrief(e);
    case "production":
      return productionList(e, base);
    case "judging":
      return judging(e, base);
    default:
      throw new Error(`No generated block is called ${name}.`);
  }
}
