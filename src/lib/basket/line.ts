import { randomUUID } from "node:crypto";
import type { Mandate, Offer, Order, Product, QuoteResponse, SignedOffer } from "@/lib/contracts";
import type { AgentTransport, ParsedRequest } from "@/lib/agent";
import { parseRequest } from "@/lib/agent";
import { findCandidates, type Candidates } from "@/lib/agent/find";
import { selectOffer, type Selection } from "@/lib/agent/select-offer";
import { displayName } from "@/lib/agent/words";
import { now } from "@/lib/clock";
import { catalog } from "@/lib/catalog";
import { hasStatus, isGatewayError } from "@/lib/gateway/errors";
import { listText } from "@/lib/policy/format";
import { offerAllowedByNeverBuy } from "@/lib/policy/never-buy";
import { classifyNoOrder, classifyOrder, type NoOrder, type Verdict } from "./classify";
import { lineDrift } from "./drift";
import { productHistory, sameAsBefore } from "./history";
import { alternativeOptions, approveOption, handoffOption, orderOption, quantityOption, safeSwapOption, skipOption, type LineRef } from "./options";
import { findSafeSwap, passesNeverRules } from "./safe-swap";
import type { LineOutcome, OfferedOption, StoredBasket, StoredLine } from "./types";
import { packsText, toQuantity } from "./units";
import { usualProductId } from "./weekly";

/** What a line needs from the run: who orders, how it calls the wholesaler, and the orders and basket it compares with. */
export interface LineContext {
  transport: AgentTransport;
  /** Awaited between steps, so the lines turn colour at a pace a person can follow. */
  pause(): Promise<void>;
  orders(): Promise<Order[]>;
  previous?: StoredBasket;
  /** For a weekly basket: the buyer's weekly baskets of earlier weeks, oldest first, for drift. */
  weeks?: StoredBasket[];
}

/** The buyer's words as the agent reads them, with the line's own quantity, day and product winning. */
export function lineRequest(line: StoredLine, deliverBy: string): ParsedRequest {
  const read = parseRequest(line.request.words, now());
  return {
    ...read,
    quantity: toQuantity(line.request.quantity),
    deliverBy,
    deliverByStated: true,
    ...(line.request.productId ? { productId: line.request.productId } : {}),
  };
}

/** Every orange or red line also offers a person at Valio Aimo. */
function finish(ref: LineRef, verdict: Verdict, options: OfferedOption[], extra: Partial<LineOutcome> = {}): LineOutcome {
  const offered = verdict.state === "green" ? [] : [...options, handoffOption(ref)];
  return { ...verdict, ...extra, options: offered };
}

function ordered(order: Order): Pick<LineOutcome, "product" | "packs" | "net" | "orderId" | "offerId"> {
  const delivered = order.offer.lines.filter((line) => line.quantity > 0);
  const main = delivered.find((line) => line.substituteFor) ?? delivered[0] ?? order.offer.lines[0];
  return {
    product: { id: main.productId, name: displayName(main.name) },
    packs: packsText(delivered),
    net: order.offer.totals.net.amount,
    orderId: order.id,
    offerId: order.offer.id,
  };
}

/** The verdict and options for a line whose order the mandate decided. */
async function afterOrder(line: StoredLine, order: Order, quote: QuoteResponse, mandate: Mandate, basket: StoredBasket, ctx: LineContext, products: Product[]): Promise<LineOutcome> {
  const ref = { id: line.id, words: line.words };
  quote = withoutBrokenRules(quote, mandate);
  const facts = ordered(order);
  const productId = facts.product?.id ?? "";
  const history = productHistory(await ctx.orders(), basket.buyer.id, productId, order.id);
  const verdict = classifyOrder(order, mandate, { history, sameAsLastWeek: sameAsBefore(ctx.previous, productId, line.asked) });
  const extra = { ...facts, history };
  if (verdict.state === "green") return finish(ref, verdict, [], extra);
  if (verdict.state === "orange") {
    const options = [approveOption(ref, order, verdict.reasonCode === "substitute_needs_ok"), ...alternativeOptions(ref, quote.alternatives, order.offer), skipOption(ref, order.id)];
    return finish(ref, verdict, options, extra);
  }
  const options: OfferedOption[] = [];
  if (verdict.reasonCode === "allergen") {
    const blockedProduct = products.find((product) => product.id === productId);
    const swap = blockedProduct
      ? await findSafeSwap(blockedProduct, toQuantity(line.request.quantity), basket.deliverBy, mandate, ctx.transport, line.words)
      : undefined;
    const excluded = mandate.dietary.excludeAllergens.filter((allergen) => blockedProduct?.allergens.contains.includes(allergen) || blockedProduct?.allergens.mayContain.includes(allergen));
    if (swap) options.push(safeSwapOption(ref, swap, listText(excluded)));
  } else {
    options.push(...alternativeOptions(ref, quote.alternatives, order.offer));
  }
  options.push(skipOption(ref));
  return finish(ref, verdict, options, extra);
}

const productOf = (id: string) => catalog().get(id);

/**
 * True when every product the offer delivers passes the mandate's "never" rules: the never-buy list in every language,
 * excluded allergens, traces when the mandate blocks them, required claims. A product the catalogue does not know
 * cannot be shown to pass, so it does not.
 */
export function offerPassesNeverRules(offer: Pick<Offer, "lines">, mandate: Mandate): boolean {
  if (!offerAllowedByNeverBuy(mandate, offer, productOf)) return false;
  return offer.lines.every((line) => {
    if (line.quantity <= 0) return true;
    const product = productOf(line.productId);
    return product !== undefined && passesNeverRules(product, mandate);
  });
}

/** The quote without alternatives a "never" rule of the mandate rules out, so a person is never offered one. */
function withoutBrokenRules(quote: QuoteResponse, mandate: Mandate): QuoteResponse {
  return { ...quote, alternatives: quote.alternatives.filter((alternative) => offerPassesNeverRules(alternative.signed.offer, mandate)) };
}

/** The verdict and options for a line the agent stopped on before ordering. */
function withoutOrder(line: StoredLine, reason: NoOrder, quote?: QuoteResponse): LineOutcome {
  const ref = { id: line.id, words: line.words };
  const verdict = classifyNoOrder(reason);
  const options: OfferedOption[] = [];
  if (quote) {
    options.push(...alternativeOptions(ref, quote.alternatives));
    const short = quote.primary.offer.lines[0];
    const take = short && short.availability.status === "partial" ? quantityOption(ref, short) : undefined;
    if (take) options.push(take);
  }
  options.push(skipOption(ref));
  const short = quote?.primary.offer.lines[0];
  const product = short ? { product: { id: short.productId, name: displayName(short.name) } } : {};
  return finish(ref, verdict, options, product);
}

/** How long a line waits before asking again after the wholesaler did not answer. */
const UPSTREAM_RETRY_MS = 1500;

function refusalOf(error: unknown): NoOrder {
  if (!isGatewayError(error)) return { kind: "error" };
  if (error.status === 502) return { kind: "no_answer" };
  if (error.code === "quantity_implausible") return { kind: "too_much" };
  if (error.code === "delivery_date_past") return { kind: "date_passed" };
  if (error.code === "unit_mismatch") return { kind: "not_found" };
  return { kind: "error" };
}

/**
 * One line as the buyer's agent works it: search, a signed offer quoted with the line's words, one order through the
 * gateway under the mandate. Never retries after a block or while an order waits for a person.
 */
export async function workLine(line: StoredLine, basket: StoredBasket, ctx: LineContext): Promise<LineOutcome> {
  try {
    return await attemptLine(line, basket, ctx);
  } catch (error) {
    if (!hasStatus(error, 502)) return withoutOrder(line, refusalOf(error));
  }
  // The wholesaler's API refuses bursts now and then; one calm retry usually gets an answer.
  await new Promise((resolve) => setTimeout(resolve, UPSTREAM_RETRY_MS));
  try {
    return await attemptLine(line, basket, ctx);
  } catch (error) {
    return withoutOrder(line, refusalOf(error));
  }
}

/** Net price per litre or kilo the offer delivers, else per sales unit, so two products compare. */
function unitPriceOf(offer: Pick<Offer, "lines" | "totals">): { amount: number; per: string } | undefined {
  const delivered = offer.lines.filter((line) => line.quantity > 0);
  if (delivered.length === 0) return undefined;
  const units = new Set(delivered.map((line) => line.content?.unit));
  const unit = units.size === 1 ? [...units][0] : undefined;
  const total = delivered.reduce((sum, line) => sum + (unit ? (line.content?.amount ?? 0) : line.quantity), 0);
  return total > 0 ? { amount: offer.totals.net.amount / total, per: unit ?? "sales_unit" } : undefined;
}

/** The share a weekly line's price may rise on last week before a person checks it, when the mandate sets no swap cap. */
const DEFAULT_PRICE_CAP = 0.15;

/**
 * Why a weekly line should wait for a person before it is ordered: its amount is far from the four-week median, or its
 * unit price rose more than the mandate lets a swap's. Undefined for any other basket, or a line that looks usual.
 */
async function driftOf(line: StoredLine, basket: StoredBasket, offer: Offer, mandate: Mandate, ctx: LineContext): Promise<string | undefined> {
  if (basket.source !== "weekly" || !ctx.weeks?.length) return undefined;
  const { amount, unit } = line.request.quantity;
  const usual = ctx.weeks.flatMap((week) =>
    week.lines.filter((other) => other.words === line.words && other.request.quantity.unit === unit).map((other) => other.request.quantity.amount),
  );
  const last = ctx.previous?.lines.find((other) => other.words === line.words && other.state === "green" && other.orderId);
  const lastOrder = last ? (await ctx.orders()).find((order) => order.id === last.orderId) : undefined;
  const now = unitPriceOf(offer);
  const before = lastOrder ? unitPriceOf(lastOrder.offer) : undefined;
  const price = now && before && now.per === before.per ? { now: now.amount, last: before.amount } : undefined;
  const pct = mandate.substitution.maxPriceIncreasePct;
  return lineDrift({ amount, usual, ...(price ? { price } : {}), cap: pct > 0 ? pct / 100 : DEFAULT_PRICE_CAP });
}

/** A weekly line the agent held back before ordering: orange with the drift, and nothing ordered until a person approves. */
async function heldForDrift(line: StoredLine, signed: SignedOffer, reason: string, basket: StoredBasket, ctx: LineContext): Promise<LineOutcome> {
  const ref = { id: line.id, words: line.words };
  const offer = signed.offer;
  const delivered = offer.lines.filter((offered) => offered.quantity > 0);
  const main = delivered.find((offered) => offered.substituteFor) ?? delivered[0] ?? offer.lines[0];
  const history = productHistory(await ctx.orders(), basket.buyer.id, main.productId);
  const extra = { product: { id: main.productId, name: displayName(main.name) }, packs: packsText(delivered), net: offer.totals.net.amount, history };
  return finish(ref, { state: "orange", reasonCode: "drift", reason }, [orderOption(ref, signed), skipOption(ref)], extra);
}

interface Picked {
  candidates: Candidates;
  selection?: Selection;
}

/** Candidates for the request, and the offer the agent selects among them; no selection when nothing matched. */
async function pick(parsed: ParsedRequest, quantity: NonNullable<ParsedRequest["quantity"]>, mandate: Mandate, ctx: LineContext): Promise<Picked> {
  const candidates = await findCandidates(parsed, ctx.transport, mandate.dietary);
  if (candidates.products.length === 0) return { candidates };
  await ctx.pause();
  const selection = await selectOffer({
    parsed: { ...parsed, quantity },
    products: candidates.products,
    hits: candidates.hits,
    confidence: candidates.confidence,
    transport: ctx.transport,
    say: async () => undefined,
    pause: ctx.pause,
  });
  return { candidates, selection };
}

async function attemptLine(line: StoredLine, basket: StoredBasket, ctx: LineContext): Promise<LineOutcome> {
  const parsed = lineRequest(line, basket.deliverBy);
  const quantity = toQuantity(line.request.quantity);
  // A standing-order line keeps last week's product; the search runs only when that product cannot be quoted.
  const usual = basket.source === "weekly" ? usualProductId(ctx.previous, line.request) : undefined;
  try {
    if (!parsed.phrase && !parsed.productId) return withoutOrder(line, { kind: "unclear" });
    const { jws: mandateJws, mandate } = await ctx.transport.getMandate();
    let picked = usual ? await pick({ ...parsed, productId: usual }, quantity, mandate, ctx).catch(() => undefined) : undefined;
    if (!picked?.selection || "failure" in picked.selection) picked = await pick(parsed, quantity, mandate, ctx);
    const { candidates, selection } = picked;
    if (!selection) return withoutOrder(line, { kind: "not_found" });
    if ("failure" in selection) {
      const quote = selection.quote ? withoutBrokenRules(selection.quote, mandate) : undefined;
      const short = quote?.primary.offer.lines[0];
      return withoutOrder(line, short ? { kind: "short", line: short, alternatives: quote?.alternatives.length ?? 0 } : { kind: "error" }, quote);
    }
    const drift = await driftOf(line, basket, selection.signed.offer, mandate, ctx);
    if (drift) return await heldForDrift(line, selection.signed, drift, basket, ctx);
    const order = await ctx.transport.placeOrder({ offerJws: selection.signed.jws, mandateJws, idempotencyKey: randomUUID() });
    return await afterOrder(line, order, selection.quote, mandate, basket, ctx, [...candidates.products, ...candidates.hits.map((hit) => hit.product)]);
  } catch (error) {
    if (hasStatus(error, 502)) throw error;
    return withoutOrder(line, refusalOf(error));
  }
}
