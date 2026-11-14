import type { Order, QuoteRequest, QuoteResponse, SearchResponse } from "@/lib/contracts";
import { call, ok } from "./router";

interface Curl {
  url: string;
  flags: string;
}

/**
 * An agent that knows nothing but the text of llms.txt. It finds the endpoints and example bodies in
 * the curl lines, then buys the milk from the worked example.
 */
export async function outsideAgent(llms: string): Promise<{ order: Order; steps: string[] }> {
  const token = llms.match(/Authorization: Bearer ([\w.-]+)/)?.[1];
  if (!token) throw new Error("llms.txt names no bearer token.");
  const curls: Curl[] = [...llms.matchAll(/^curl -s (\S+)(.*)$/gm)].map((match) => ({ url: match[1], flags: match[2] }));
  const endpoint = (pattern: RegExp): Curl => {
    const found = curls.find((curl) => pattern.test(new URL(curl.url).pathname));
    if (!found) throw new Error(`llms.txt shows no endpoint matching ${pattern}.`);
    return found;
  };
  const bodyOf = (curl: Curl): Record<string, unknown> => {
    const raw = curl.flags.match(/-d '([^']*)'/)?.[1];
    if (!raw) throw new Error(`llms.txt gives no body for ${curl.url}.`);
    return JSON.parse(raw) as Record<string, unknown>;
  };
  const auth = { authorization: `Bearer ${token}` };
  const steps: string[] = [];

  const search = endpoint(/\/products\/search$/);
  const found = ok<SearchResponse>(await call("POST", search.url, { body: bodyOf(search), headers: auth }), "Search");
  const product = found.hits.find((hit) => hit.product.content?.unit === "l")?.product;
  if (!product) throw new Error("The search found no milk sold by the litre.");
  steps.push(`${new URL(search.url).pathname} -> ${product.id}`);

  const quote = endpoint(/\/quotes$/);
  const example = bodyOf(quote) as QuoteRequest;
  const request = { ...example, lines: example.lines.map((line) => ({ ...line, productId: product.id })) };
  const offer = ok<QuoteResponse>(await call("POST", quote.url, { body: request, headers: auth }), "Quote");
  steps.push(`${new URL(quote.url).pathname} -> ${offer.primary.offer.fulfilment}`);

  const mandateUrl = endpoint(/\/mandate$/).url;
  const { jws: mandateJws } = ok<{ jws: string }>(await call("GET", mandateUrl, { headers: auth }), "Mandate");
  steps.push(`${new URL(mandateUrl).pathname} -> jws`);

  const orders = endpoint(/\/orders$/);
  const keyHeader = orders.flags.match(/-H "(Idempotency-Key): [^"]*"/i)?.[1] ?? "Idempotency-Key";
  const headers = { ...auth, [keyHeader]: "outside-agent-milk-0001" };
  const order = ok<Order>(await call("POST", orders.url, { body: { offerJws: offer.primary.jws, mandateJws }, headers }), "Order");
  steps.push(`${new URL(orders.url).pathname} -> ${order.status}`);
  return { order, steps };
}
