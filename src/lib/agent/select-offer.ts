import type { OfferLine, Product, Quantity, QuoteRequest, SearchHit, SignedOffer } from "@/lib/contracts";
import { lineOnTime, offerOnTime, offerOnlyLate, pickAlternative, rankByPrice, rankHits } from "./choose";
import { shortDay } from "./dates";
import type { AgentTransport, ParsedRequest } from "./types";
import { displayName, euro, perUnitWord, problemNote, quantityText, type Situation } from "./words";

const MAX_QUOTES = 3;
const MAX_SKIP_NOTES = 2;

export interface SelectContext {
  parsed: ParsedRequest & { quantity: Quantity };
  products: Product[];
  /** Search hits; when they carry previews the agent picks from them without a comparison quote. */
  hits: SearchHit[];
  confidence: QuoteRequest["matchConfidence"];
  transport: AgentTransport;
  say(text: string): Promise<void>;
  pause(): Promise<void>;
}

export type Selection = { signed: SignedOffer } | { failure: string };

interface Plan {
  /** Product ids to quote, in order. */
  order: string[];
  quotesUsed: number;
}

function fromLine(line: OfferLine, product: Product | undefined): Situation {
  const { status, available, deliveryDate } = line.availability;
  return { name: displayName(line.name), salesUnit: line.salesUnit, status, available, deliveryDate, packContent: product?.content };
}

function fromHit(hit: SearchHit): Situation {
  const { product, offerPreview } = hit;
  const availability = offerPreview?.availability;
  return {
    name: displayName(product.name.en || product.name.fi),
    salesUnit: product.salesUnit,
    status: availability?.status ?? "unavailable",
    available: availability?.available,
    deliveryDate: availability?.deliveryDate,
    packContent: offerPreview?.contentPerUnit ?? product.content,
  };
}

function quoteRequest(ctx: SelectContext, productIds: string[]): QuoteRequest {
  return {
    lines: productIds.map((productId) => ({ productId, quantity: ctx.parsed.quantity })),
    deliverBy: ctx.parsed.deliverBy,
    intent: ctx.parsed.text,
    matchConfidence: ctx.confidence,
  };
}

async function announce(ctx: SelectContext, skipped: Situation[], name: string, price: number): Promise<void> {
  for (const item of skipped.slice(0, MAX_SKIP_NOTES)) await ctx.say(problemNote(item, ctx.parsed.deliverBy));
  await ctx.say(`Cheapest match: ${name} at ${euro(price)} per ${perUnitWord(ctx.parsed.quantity.unit)}.`);
}

/** Picks from the live previews on the search hits. Undefined when the hits carry none. */
async function fromPreviews(ctx: SelectContext): Promise<Plan | undefined> {
  const ranked = rankHits(ctx.hits, ctx.parsed.quantity);
  if (ranked.length === 0) return undefined;
  const late = (r: (typeof ranked)[number]) => r.preview.availability.status === "available";
  const pick = ranked.find((r) => r.preview.orderable) ?? ranked.find(late) ?? ranked[0];
  const skipped = ranked.slice(0, ranked.indexOf(pick)).map((r) => fromHit(r.hit));
  const notOrderable = ranked.filter((r) => !r.preview.orderable).length;
  if (ranked.length > 1) {
    const rest = notOrderable > 0 ? ` ${notOrderable} cannot be delivered in full on time.` : "";
    await ctx.say(`Compared live prices for ${ranked.length} matches.${rest}`);
  }
  await announce(ctx, skipped, fromHit(pick.hit).name, pick.price);
  const rest = ranked.filter((r) => r !== pick && r.preview.orderable).map((r) => r.hit.product.id);
  return { order: [pick.hit.product.id, ...rest], quotesUsed: 0 };
}

/** Without previews: one quote for every candidate, to compare prices and stock. */
async function fromComparisonQuote(ctx: SelectContext): Promise<Plan> {
  const { unit } = ctx.parsed.quantity;
  const { deliverBy } = ctx.parsed;
  const response = await ctx.transport.requestQuote(quoteRequest(ctx, ctx.products.map((p) => p.id)));
  await ctx.say(`Compared prices for ${ctx.products.length} matches.`);
  const ranked = rankByPrice(response.primary.offer.lines, unit);
  if (ranked.length === 0) return { order: ctx.products.map((p) => p.id), quotesUsed: 1 };
  const orderable = (line: OfferLine) => line.availability.status === "available" && line.quantity > 0;
  const pick = ranked.find((r) => lineOnTime(r.line, deliverBy)) ?? ranked.find((r) => orderable(r.line)) ?? ranked[0];
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const skipped = ranked.slice(0, ranked.indexOf(pick)).map((r) => fromLine(r.line, byId.get(r.line.productId)));
  await announce(ctx, skipped, displayName(pick.line.name), pick.price);
  const rest = ranked.filter((r) => r !== pick && lineOnTime(r.line, deliverBy)).map((r) => r.line.productId);
  return { order: [pick.line.productId, ...rest], quotesUsed: 1 };
}

async function plan(ctx: SelectContext): Promise<Plan> {
  if (ctx.products.length <= 1) return { order: ctx.products.map((p) => p.id), quotesUsed: 0 };
  const chosen = (await fromPreviews(ctx)) ?? (await fromComparisonQuote(ctx));
  await ctx.pause();
  return chosen;
}

/**
 * Get a signed offer that covers the need on time: the cheapest candidate, else the wholesaler's signed
 * alternative, else the next candidate. At most three quotes. A full but late offer is kept as a last resort,
 * so the mandate decides whether a later date is acceptable.
 */
export async function selectOffer(ctx: SelectContext): Promise<Selection> {
  const { order, quotesUsed } = await plan(ctx);
  let quotes = quotesUsed;
  let late: SignedOffer | undefined;
  for (const productId of order) {
    if (quotes >= MAX_QUOTES) break;
    await ctx.say("Asked for a fixed-price offer.");
    const response = await ctx.transport.requestQuote(quoteRequest(ctx, [productId]));
    quotes++;
    const { offer } = response.primary;
    if (offerOnTime(offer)) return { signed: response.primary };
    const product = ctx.products.find((p) => p.id === productId) ?? ctx.hits.find((h) => h.product.id === productId)?.product;
    await ctx.say(problemNote(fromLine(offer.lines[0], product), ctx.parsed.deliverBy));
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
