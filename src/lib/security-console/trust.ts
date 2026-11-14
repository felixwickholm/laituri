import { count } from "@/lib/console/format/money";
import type { Facts } from "@/lib/evidence/types";
import { TOKEN_TYPE } from "@/lib/trust/types";

export interface TestedLine {
  id: string;
  figure: string;
  label: string;
  proves: string;
}

const PROVES: Record<string, { label: string; proves: string }> = {
  guardrails: { label: "guardrail checks pass", proves: "Each one tries to get past your limits or a fixed price." },
  trust: { label: "trust checks pass", proves: "Each one checks a seal, or tries to change, cut or reorder the record." },
};

/** The measured guardrail and trust suites, each as "35 of 35" plus one line on what it proves. Nothing typed by hand. */
export function testedLines(facts: Facts): TestedLine[] {
  return facts.evals.suites
    .filter((suite) => suite.id in PROVES)
    .map((suite) => ({ id: suite.id, figure: `${count(suite.passed)} of ${count(suite.total)}`, ...PROVES[suite.id] }));
}

/** The signed token types, for the technical details: one line each, as the server checks them. */
export function tokenTypes(): string {
  return Object.values(TOKEN_TYPE).join(", ");
}

interface UpstreamFigures {
  productsAsked: number;
  catalogueSize: number;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Reads the upstream call counts from `/api/v1/health`, when the server reports them. */
export function upstreamFigures(health: unknown): UpstreamFigures | undefined {
  if (!health || typeof health !== "object") return undefined;
  const root = health as { upstream?: { productsAsked?: unknown; catalogueSize?: unknown }; catalogueSize?: unknown };
  const productsAsked = root.upstream?.productsAsked;
  const catalogueSize = root.catalogueSize ?? root.upstream?.catalogueSize;
  if (!isCount(productsAsked) || !isCount(catalogueSize) || catalogueSize === 0) return undefined;
  return { productsAsked, catalogueSize };
}

/** "Valio Aimo's price and stock systems are asked only about … N of 17,546 this week." Undefined without the figures. */
export function upstreamLine(health: unknown): string | undefined {
  const figures = upstreamFigures(health);
  if (!figures) return undefined;
  return `Valio Aimo’s price and stock systems are asked only about the few products a request needs: ${count(figures.productsAsked)} of ${count(figures.catalogueSize)} this week.`;
}
