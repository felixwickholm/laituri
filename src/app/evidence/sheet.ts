import type { Criterion, Requirement } from "@/lib/evidence/types";

/**
 * Valio Aimo's printed challenge sheet uses shorter names than the web brief. The names below are copied from the
 * sheet; every claim beside them comes from the evidence source, matched by the start of the web brief's own words.
 */

/** The flow the sheet says a solution must run, in its four words, with where a judge can see each step. */
export const SHEET_FLOW = [
  { step: "Request", line: "The kitchen or its agent says what it needs.", href: "/buyer" },
  { step: "Lookup", line: "Find products, prices and stock.", href: "/buyer/shop" },
  { step: "Order", line: "Order at a fixed price Valio Aimo signs.", href: "/buyer/orders" },
  { step: "Approval", line: "The agent decides inside your limits, or a person signs off.", href: "/buyer/mandate" },
] as const;

const MUST_BUILD = [
  { name: "Lookup", match: "Product, price & availability lookup" },
  { name: "Request and order", match: "Requesting price & availability" },
  { name: "Permissions and approval", match: "Permission & human-approval" },
];

const BONUS = [
  { name: "Compare more than price", match: "Delivery time & sustainability" },
  { name: "Handle exceptions", match: "Substitution and other exception" },
  { name: "Explain decisions", match: "Traceability and explainability" },
];

const CRITERIA: Record<string, string> = {
  "Working end-to-end demo": "Working end-to-end demo",
  "Solving the problem and user need": "Solving the user's need",
  "Autonomy and controls": "Autonomy and controls (guardrails)",
  "Robustness to exception situations": "Robustness to exceptions",
  "Openness and credible path toward production": "Openness and path to production",
};

export interface SheetItem {
  name: string;
  requirement: Requirement;
}

function pick(list: { name: string; match: string }[], requirements: Requirement[]): SheetItem[] {
  return list.flatMap(({ name, match }) => {
    const requirement = requirements.find((item) => item.quote.startsWith(match));
    return requirement ? [{ name, requirement }] : [];
  });
}

/** The sheet's three "must build" items, each with the source's answer. An item the source lacks is left out. */
export function mustBuild(core: Requirement[]): SheetItem[] {
  return pick(MUST_BUILD, core);
}

/** The sheet's three bonus ideas, each with the source's answer. */
export function bonusIdeas(optional: Requirement[]): SheetItem[] {
  return pick(BONUS, optional);
}

/** The sheet's short name for an official criterion, when it has one that differs. */
export function sheetName(criterion: Pick<Criterion, "name">): string | undefined {
  const short = CRITERIA[criterion.name];
  return short && short !== criterion.name ? short : undefined;
}
