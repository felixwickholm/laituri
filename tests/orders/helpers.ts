import type { QuoteRequest } from "@/lib/contracts";
import { quote } from "@/lib/offers";
import { makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

export async function setup(productId = "464306", amount = 1000) {
  const env = makeDeps();
  const request: QuoteRequest = { lines: [{ productId, quantity: { amount, unit: "l" } }], deliverBy: DELIVER_BY };
  const quoted = await quote(request, { customerNumber: "123" }, env.deps);
  const { jws: mandateJws } = await env.deps.mandates.current();
  return { ...env, quoted, mandateJws, offerJws: quoted.primary.jws };
}
