import type { OfferLine, Product, Quantity, QuoteRequest, SignedOffer } from "@/lib/contracts";
import { lineOnTime, offerOnTime, offerOnlyLate, pickAlternative, rankByPrice } from "./choose";
import { shortDay } from "./dates";
import type { AgentTransport, ParsedRequest } from "./types";
import { amount, euro, lineProblem, packName, perUnitWord, quantityText } from "./words";

const MAX_QUOTES = 3;

export interface SelectContext {
  parsed: ParsedRequest & { quantity: Quantity };
  products: Product[];
  confidence: QuoteRequest["matchConfidence"];
  transport: AgentTransport;
  say(text: string): Promise<void>;
  pause(): Promise<void>;
}

export type Selection = { signed: SignedOffer } | { failure: string };

/** Why one line is not usable as asked, naming the pack. */
function problemNote(line: OfferLine, product: Product | undefined, deliverBy: string): string {
  const { status, available, deliveryDate } = line.availability;
  if (status === "partial") return `${line.name}: only ${amount(available)} in stock.`;
  if (status === "available" && deliveryDate && deliveryDate > deliverBy) {
    return `${line.name} arrives ${shortDay(deliveryDate)}, after ${shortDay(deliverBy)}.`;
  }
  return `Skipped ${packName(line, product?.content)}. ${lineProblem(line, deliverBy)}`;
}

function quoteRequest(ctx: SelectContext, productIds: string[]): QuoteRequest {
  return {
    lines: productIds.map((productId) => ({ productId, quantity: ctx.parsed.quantity })),
    deliverBy: ctx.parsed.deliverBy,
    intent: ctx.parsed.text,
    matchConfidence: ctx.confidence,
  };
}

/** One quote for every candidate, to compare prices and stock. Returns product ids in the order to try. */
async function compare(ctx: SelectContext): Promise<string[]> {
  const { unit } = ctx.parsed.quantity;
  const { deliverBy } = ctx.parsed;
  const response = await ctx.transport.requestQuote(quoteRequest(ctx, ctx.products.map((p) => p.id)));
  await ctx.say(`Compared prices for ${ctx.products.length} matches.`);
  const ranked = rankByPrice(response.primary.offer.lines, unit);
  if (ranked.length === 0) return ctx.products.map((p) => p.id);
  const orderable = (line: OfferLine) => line.availability.status === "available" && line.quantity > 0;
  const pick = ranked.find((r) => lineOnTime(r.line, deliverBy)) ?? ranked.find((r) => orderable(r.line)) ?? ranked[0];
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  for (const cheaper of ranked.slice(0, ranked.indexOf(pick)).slice(0, 2)) {
    await ctx.say(problemNote(cheaper.line, byId.get(cheaper.line.productId), deliverBy));
  }
  await ctx.say(`Cheapest match: ${pick.line.name} at ${euro(pick.price)} per ${perUnitWord(unit)}.`);
  const rest = ranked.filter((r) => r !== pick && lineOnTime(r.line, deliverBy)).map((r) => r.line.productId);
  return [pick.line.productId, ...rest];
}

/**
 * Get a signed offer that covers the need on time: the cheapest candidate, else the wholesaler's signed
 * alternative, else the next candidate. At most three quotes. A full but late offer is kept as a last resort,
 * so the mandate decides whether a later date is acceptable.
 */
export async function selectOffer(ctx: SelectContext): Promise<Selection> {
  let quotes = 0;
  let order = ctx.products.map((p) => p.id);
  if (ctx.products.length > 1) {
    order = await compare(ctx);
    quotes++;
    await ctx.pause();
  } else {
    await ctx.say(`Using ${ctx.products[0].name.en || ctx.products[0].name.fi} (product ${ctx.products[0].id}).`);
  }

  let late: SignedOffer | undefined;
  for (const productId of order) {
    if (quotes >= MAX_QUOTES) break;
    await ctx.say("Asked for a fixed-price offer.");
    const response = await ctx.transport.requestQuote(quoteRequest(ctx, [productId]));
    quotes++;
    const { offer } = response.primary;
    if (offerOnTime(offer)) return { signed: response.primary };
    const line = offer.lines[0];
    await ctx.say(problemNote(line, ctx.products.find((p) => p.id === productId), ctx.parsed.deliverBy));
    const alternative = pickAlternative(response);
    if (alternative) {
      await ctx.say(`Took the wholesaler's signed alternative. ${alternative.tradeoff}`);
      return { signed: alternative.signed };
    }
    if (!late && offerOnlyLate(offer)) late = response.primary;
    await ctx.pause();
  }
  if (late) {
    await ctx.say(`Nothing arrives by ${shortDay(ctx.parsed.deliverBy)}. Taking the earliest date and letting the mandate decide.`);
    return { signed: late };
  }
  return { failure: `No offer covers ${quantityText(ctx.parsed.quantity)} by ${shortDay(ctx.parsed.deliverBy)}.` };
}
