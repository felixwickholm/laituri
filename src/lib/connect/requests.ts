/**
 * The shared workspace's public key for the primary demo buyer's agent. The page shows it only until this browser's
 * workspace answers with the visitor's own keys.
 */
export const DEMO_KEY = "demo-agent-token";

/** The Authorization header value an agent sends with its key. */
export const authHeader = (key: string) => `Bearer ${key}`;

/** What a buyer would say to their own agent. Pasted after connecting. */
export const PROMPT = "Order 1,000 litres of lactose-free milk for Monday from Valio Aimo. Stay inside my limits.";

/** The worked example: one product, one need, one delivery date. */
export const MILK = {
  query: "laktoositon maito 1 l",
  productId: "464306",
  need: { amount: 1000, unit: "l" },
  intent: "1,000 litres of lactose-free milk by Monday",
} as const;

export interface Need {
  amount: number;
  unit: "l";
  intent: string;
}

/** The worked example's quantity, for the copied commands. */
export const EXAMPLE_NEED: Need = { ...MILK.need, intent: MILK.intent };

/**
 * The browser's test order: the same product, small enough that repeated tests stay inside the demo buyer's
 * weekly limit and keep confirming.
 */
export const TEST_NEED: Need = { amount: 20, unit: "l", intent: "20 litres of lactose-free milk by Monday" };

export const PATHS = {
  mcp: "/mcp",
  search: "/api/v1/products/search",
  quotes: "/api/v1/quotes",
  mandate: "/api/v1/mandate",
  orders: "/api/v1/orders",
  activity: "/api/v1/activity",
  openapi: "/api/v1/openapi.json",
  llms: "/llms.txt",
} as const;

/** The first Monday after `today`, as YYYY-MM-DD in Helsinki time, where the wholesaler delivers. */
export function nextMonday(today: Date): string {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(today);
  const date = new Date(`${local}T12:00:00Z`);
  const ahead = ((8 - date.getUTCDay()) % 7) || 7;
  date.setUTCDate(date.getUTCDate() + ahead);
  return date.toISOString().slice(0, 10);
}

export function searchBody(deliverBy: string, need: Need = EXAMPLE_NEED) {
  return { query: MILK.query, filters: { claims: ["lactose_free"] }, limit: 5, need: { amount: need.amount, unit: need.unit }, deliverBy };
}

export function quoteBody(deliverBy: string, need: Need = EXAMPLE_NEED) {
  return {
    lines: [{ productId: MILK.productId, quantity: { amount: need.amount, unit: need.unit } }],
    deliverBy,
    intent: need.intent,
    matchConfidence: "high",
  };
}

export function orderBody(offerJws: string, mandateJws: string) {
  return { offerJws, mandateJws };
}
