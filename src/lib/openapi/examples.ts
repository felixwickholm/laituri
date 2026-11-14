/** Worked example: "1,000 litres of lactose-free milk by Monday". */
export const MILK = {
  intent: "1,000 litres of lactose-free milk by Monday",
  productId: "464306",
  deliverBy: "2026-11-16",
} as const;

export const EXAMPLES = {
  search: {
    request: {
      query: "laktoositon maito 1 l",
      filters: { claims: ["lactose_free"], categoryGroup: "dairy" },
      limit: 5,
      need: { amount: 1000, unit: "l" },
      deliverBy: MILK.deliverBy,
    },
  },
  quote: {
    request: {
      lines: [{ productId: MILK.productId, quantity: { amount: 1000, unit: "l" } }],
      deliverBy: MILK.deliverBy,
      intent: MILK.intent,
      matchConfidence: "high",
    },
  },
  order: {
    request: {
      offerJws: "<primary.jws from POST /api/v1/quotes>",
      mandateJws: "<jws from GET /api/v1/mandate>",
      idempotencyKey: "milk-2026-11-16-001",
    },
  },
} as const;
