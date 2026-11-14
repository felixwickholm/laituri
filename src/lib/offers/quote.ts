import type { Alternative, Product, QuoteRequest, QuoteResponse } from "@/lib/contracts";
import { UpstreamError, errorMessage } from "@/lib/gateway/errors";
import { planAlternatives, type Need } from "./alternatives";
import { assembleOffer, issueOffer } from "./assemble";
import { quoteLine } from "./lines";
import type { Market, OfferDeps, QuoteContext } from "./types";

const SUBSTITUTE_CANDIDATES = 12;
const UPSTREAM_BATCH_LIMIT = 1000;

async function fetchMarket(ids: string[], request: QuoteRequest, ctx: QuoteContext, deps: OfferDeps): Promise<Market> {
  try {
    const [prices, availability] = await Promise.all([
      deps.upstream.price(ids, request.deliverBy, ctx.customerNumber),
      deps.upstream.availability(ids, request.deliverBy, ctx.customerNumber),
    ]);
    return { prices, availability, now: deps.now(), deliverBy: request.deliverBy };
  } catch (error) {
    throw new UpstreamError(`The wholesaler's price or stock service did not answer: ${errorMessage(error)}`);
  }
}

/**
 * Price the request as asked, with honest availability, and sign it.
 * When it cannot be met in full and on time, add up to three signed alternatives.
 * Requested products and their substitute candidates share one price call and one availability call.
 */
export async function quote(request: QuoteRequest, ctx: QuoteContext, deps: OfferDeps): Promise<QuoteResponse> {
  const requested = request.lines.map((line) => ({ line, product: deps.catalog.get(line.productId) }));
  const candidates = new Map<string, Product[]>();
  for (const { product } of requested) {
    if (product && !candidates.has(product.id)) {
      candidates.set(product.id, deps.catalog.substitutesFor(product.id, SUBSTITUTE_CANDIDATES));
    }
  }
  const ids = [
    ...new Set([
      ...request.lines.map((line) => line.productId),
      ...[...candidates.values()].flat().map((product) => product.id),
    ]),
  ].slice(0, UPSTREAM_BATCH_LIMIT);

  const market = await fetchMarket(ids, request, ctx, deps);
  const needs: Need[] = requested.map(({ line, product }) => ({
    original: product,
    quantity: line.quantity,
    primary: quoteLine(line.productId, product, line.quantity, market),
    candidates: product ? candidates.get(product.id) ?? [] : [],
  }));

  const base = { request, customerNumber: ctx.customerNumber, now: market.now };
  const primaryOffer = assembleOffer({ ...base, lines: needs.map((need) => need.primary) });
  const primary = await issueOffer(primaryOffer, deps);
  if (primaryOffer.fulfilment === "full") return { primary, alternatives: [] };

  const alternatives: Alternative[] = [];
  for (const plan of planAlternatives(needs, market)) {
    const signed = await issueOffer(assembleOffer({ ...base, lines: plan.lines }), deps);
    alternatives.push({ tier: plan.tier, tradeoff: plan.tradeoff, signed });
  }
  return { primary, alternatives };
}
