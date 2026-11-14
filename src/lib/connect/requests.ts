/** The demo agent's key. It names the agent in the mandate; without it orders from the caller are blocked. */
export const DEMO_KEY = "demo-agent-token";

export const AUTH_HEADER = `Bearer ${DEMO_KEY}`;

/** What a buyer would say to their own agent. Pasted after connecting. */
export const PROMPT = "Order 1,000 litres of lactose-free milk for Monday from Valio Aimo. Stay inside the mandate.";

/** The worked example: one product, one need, one delivery date. */
export const MILK = {
  query: "laktoositon maito 1 l",
  productId: "464306",
  need: { amount: 1000, unit: "l" },
  intent: "1,000 litres of lactose-free milk by Monday",
} as const;

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

export function searchBody(deliverBy: string) {
  return { query: MILK.query, filters: { claims: ["lactose_free"] }, limit: 5, need: MILK.need, deliverBy };
}

export function quoteBody(deliverBy: string) {
  return {
    lines: [{ productId: MILK.productId, quantity: MILK.need }],
    deliverBy,
    intent: MILK.intent,
    matchConfidence: "high",
  };
}

export function orderBody(offerJws: string, mandateJws: string) {
  return { offerJws, mandateJws };
}
