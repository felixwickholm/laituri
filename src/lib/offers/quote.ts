import type { Alternative, Product, QuoteRequest, QuoteResponse, SignedOffer } from "@/lib/contracts";
import { NotFoundError, UpstreamError } from "@/lib/gateway/errors";
import { UPSTREAM_ID_CAP } from "@/lib/valio/budget";
import type { UpstreamAvailability, UpstreamPrice } from "@/lib/valio/types";
import { checkRequest, offeredLines, readBuyerWords } from "@/lib/request";
import { TIER_MEANING, planAlternatives, type Need } from "./alternatives";
import { assembleOffer, issueOffer } from "./assemble";
import { productName } from "./format";
import { UnitMismatchError, checkQuoteLimits } from "./limits";
import { quoteLine } from "./lines";
import { contentPerUnit } from "./packs";
import { marketOf } from "./market";
import { stockLedger } from "./stock";
import type { BuiltLine, Market, OfferDeps, QuoteContext } from "./types";

/** The product asked for and its closest substitutes fill one line's share of the upstream cap. */
const SUBSTITUTE_CANDIDATES = UPSTREAM_ID_CAP.quoteLine - 1;

const UNIT_NAME = { l: "litre", kg: "kilo" } as const;

async function fetchMarket(ids: string[], request: QuoteRequest, ctx: QuoteContext, deps: OfferDeps): Promise<Market> {
  let answers: [Map<string, UpstreamPrice>, Map<string, UpstreamAvailability>];
  try {
    answers = await Promise.all([
      deps.upstream.price(ids, request.deliverBy, ctx.customerNumber),
      deps.upstream.availability(ids, request.deliverBy, ctx.customerNumber),
    ]);
  } catch {
    throw new UpstreamError("The wholesaler's price or stock service did not answer. Try again in a minute.");
  }
  const [prices, availability] = answers;
  return marketOf(prices, availability, await deps.store.orders.list(), deps.now(), request.deliverBy);
}

/** Every requested product must exist; a quantity in litres or kilos must be one the product is sold by. */
function requestedProducts(request: QuoteRequest, deps: OfferDeps): { line: QuoteRequest["lines"][number]; product: Product }[] {
  return request.lines.map((line) => {
    const product = deps.catalog.get(line.productId);
    if (!product) throw new NotFoundError(`Product ${line.productId} is not in the catalogue. Search the catalogue for a product code.`);
    return { line, product };
  });
}

function checkUnits(requested: { line: QuoteRequest["lines"][number]; product: Product }[], market: Market): void {
  for (const { line, product } of requested) {
    const { unit } = line.quantity;
    if (unit === "sales_unit") continue;
    const content = contentPerUnit(product, market.prices.get(product.id));
    if (content?.unit === unit) continue;
    const soldBy = content ? `is sold by the ${UNIT_NAME[content.unit]}` : "has no known content per pack";
    throw new UnitMismatchError(
      `${productName(product)} ${soldBy}, so ${line.quantity.amount} ${unit} cannot be converted. Ask in ${content ? content.unit : "sales units"} or in sales units.`,
    );
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
  const requested = requestedProducts(request, deps);
  const candidates = new Map<string, Product[]>();
  for (const { product } of requested) {
    if (!candidates.has(product.id)) candidates.set(product.id, deps.catalog.substitutesFor(product.id, SUBSTITUTE_CANDIDATES));
  }
  const ids = [
    ...new Set([
      ...request.lines.map((line) => line.productId),
      ...[...candidates.values()].flat().map((product) => product.id),
    ]),
  ].slice(0, UPSTREAM_ID_CAP.quoteLine * request.lines.length);

  const market = await fetchMarket(ids, request, ctx, deps);
  checkUnits(requested, market);
  // Lines of one product share its stock: each line is offered only what the lines before it left.
  const ledger = stockLedger(market);
  const needs: Need[] = requested.map(({ line, product }) => {
    const primary = quoteLine(line.productId, product, line.quantity, ledger.view());
    ledger.claim([primary.line]);
    return { original: product, quantity: line.quantity, primary, candidates: candidates.get(product.id) ?? [] };
  });

  const base = {
    request,
    customerNumber: ctx.customerNumber,
    buyer: ctx.buyer,
    audience: deps.audience(),
    now: market.now,
    validityMs: deps.offerValidityMs?.(),
  };
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
