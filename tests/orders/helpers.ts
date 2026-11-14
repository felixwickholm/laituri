import type { QuoteRequest } from "@/lib/contracts";
import { quote } from "@/lib/offers";
import { QUOTE_CONTEXT, makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

export async function setup(productId = "464306", amount = 1000) {
  const env = makeDeps();
  const request: QuoteRequest = {
    lines: [{ productId, quantity: { amount, unit: "l" } }],
    deliverBy: DELIVER_BY,
    intent: `${amount} litres of product ${productId} by Monday`,
  };
  const quoted = await quote(request, QUOTE_CONTEXT, env.deps);
  const { jws: mandateJws } = await env.deps.mandates.current();
  return { ...env, quoted, mandateJws, offerJws: quoted.primary.jws };
}
