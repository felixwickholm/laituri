import type { Activity } from "@/lib/store/types";
import type { Basket, LineState } from "@/lib/contracts";

/** How long an agent step keeps the strip on screen. */
export const STEP_WINDOW_MS = 90_000;
/** How long an agent's basket counts as "just now" in the cart. */
export const BASKET_WINDOW_MS = 10 * 60_000;


export interface AgentStep {
  id: string;
  at: string;
  agent: string;
  sentence: string;
  /** What the agent searched for, so the shop can show the same list. */
  query?: string;
  /** The step left an order waiting for a person: the strip links to Orders, where it is decided. */
  waiting?: boolean;
}

const QUOTED = /'([^']+)'/;

/** One agent call in plain words, said after "Your agent is shopping." */
export function stepSentence(record: Pick<Activity, "tool" | "title" | "status">): { sentence: string; query?: string; waiting?: boolean } {
  switch (record.tool) {
    case "search_catalog": {
      const query = record.title.match(QUOTED)?.[1];
      return query ? { sentence: `Searched for “${query}”.`, query } : { sentence: "Searched the shop." };
    }
    case "get_product":
      return { sentence: "Looked at a product." };
    case "request_quote":
      return { sentence: "Asked for a fixed price." };
    case "place_order":
      if (record.status === "waiting") return { sentence: "Placed an order. It needs you.", waiting: true };
      if (record.status === "blocked") return { sentence: "Tried to order. It was blocked." };
      return { sentence: "Placed an order." };
    case "place_basket":
      return { sentence: "Sent a basket." };
    case "get_mandate":
      return { sentence: "Read your limits." };
    default:
      return { sentence: "Working." };
  }
}

/** An agent call in this workspace: a keyed agent, not demo history. The shop's own searches carry no key. */
function isAgentCall(record: Activity): boolean {
  return record.kind === "tool" && record.agent.id !== "agent:anonymous" && !record.seeded;
}

/** The latest agent step inside the window, or nothing when no agent is at work. */
export function latestAgentStep(activity: Activity[], now: number): AgentStep | undefined {
  let latest: Activity | undefined;
  for (const record of activity) {
    if (!isAgentCall(record)) continue;
    if (!latest || record.at > latest.at) latest = record;
  }
  if (!latest || now - Date.parse(latest.at) > STEP_WINDOW_MS) return undefined;
  return { id: latest.id, at: latest.at, agent: latest.agent.name, ...stepSentence(latest) };
}

export interface AgentBasket {
  id: string;
  sentence: string;
  counts: Record<Exclude<LineState, "working">, number> & { working: number };
  productIds: string[];
}

/** The newest basket an agent placed in the last ten minutes, said plainly. A person's shop order is not an agent's. */
export function recentAgentBasket(baskets: Basket[], now: number): AgentBasket | undefined {
  const basket = baskets
    .filter((item) => item.source !== "manual" && !item.seeded && now - Date.parse(item.createdAt) <= BASKET_WINDOW_MS)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!basket) return undefined;
  const { lines, green, orange, red, working } = basket.totals;
  const verb = basket.status === "running" ? "is ordering" : "ordered";
  return {
    id: basket.id,
    sentence: `Your agent ${verb} ${lines} ${lines === 1 ? "line" : "lines"} just now.`,
    counts: { green, orange, red, working },
    productIds: basket.lines.flatMap((line) => (line.product ? [line.product.id] : [])),
  };
}
