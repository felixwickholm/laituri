import type { Alternative, Product, QuoteRequest, QuoteResponse, SignedOffer } from "@/lib/contracts";
import { UpstreamError, errorMessage } from "@/lib/gateway/errors";
import { checkRequest, offeredLines, readBuyerWords } from "@/lib/request";
import { TIER_MEANING, planAlternatives, type Need } from "./alternatives";
import { assembleOffer, issueOffer } from "./assemble";
import { productName } from "./format";
import { checkQuoteLimits } from "./limits";
import { quoteLine } from "./lines";
import { stockLedger } from "./stock";
import type { BuiltLine, Market, OfferDeps, QuoteContext } from "./types";

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
 * Price the request as asked, with honest availability, and sign it. A past date or an implausible quantity is refused first.
 * When it cannot be met in full and on time, add up to three signed alternatives.
 * Requested products and their substitute candidates share one price call and one availability call.
 */
export async function quote(request: QuoteRequest, ctx: QuoteContext, deps: OfferDeps): Promise<QuoteResponse> {
  checkQuoteLimits(request, deps.now(), (id) => {
    const product = deps.catalog.get(id);
    return product ? productName(product) : `product ${id}`;
  });
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
  // Lines of one product share its stock: each line is offered only what the lines before it left.
  const ledger = stockLedger(market);
  const needs: Need[] = requested.map(({ line, product }) => {
    const primary = quoteLine(line.productId, product, line.quantity, ledger.view());
    ledger.claim([primary.line]);
    return { original: product, quantity: line.quantity, primary, candidates: product ? candidates.get(product.id) ?? [] : [] };
  });

  const base = { request, customerNumber: ctx.customerNumber, buyer: ctx.buyer, now: market.now, validityMs: deps.offerValidityMs?.() };
  // The buyer's words as they stood at quote time, held against every offer before it is signed.
  const words = request.intent ? readBuyerWords(request.intent, market.now) : undefined;
  const issue = (lines: BuiltLine[]): Promise<SignedOffer> => {
    const offer = assembleOffer({ ...base, lines });
    const requestCheck = words ? checkRequest(words, offer, offeredLines(lines, (id) => deps.catalog.get(id))) : undefined;
    return issueOffer(requestCheck ? { ...offer, requestCheck } : offer, deps);
  };
  const primary = await issue(needs.map((need) => need.primary));
  if (primary.offer.fulfilment === "full") return { primary, alternatives: [] };

  const alternatives: Alternative[] = [];
  for (const plan of planAlternatives(needs, market)) {
    alternatives.push({ tier: plan.tier, meaning: TIER_MEANING[plan.tier], tradeoff: plan.tradeoff, signed: await issue(plan.lines) });
  }
  return { primary, alternatives };
}
