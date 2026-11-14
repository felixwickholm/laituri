import { randomUUID } from "node:crypto";
import type { Order, QuoteResponse, SignedOffer } from "@/lib/contracts";
import type { AgentRef, Gateway } from "@/lib/gateway/types";
import type { SeedRequest, SeedTime } from "./plan";
import { deliverySlot, helsinkiInstant, weekAheadSlot, workingDaysBefore } from "./schedule";
import type { SeedUpstream } from "./upstream";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
/** The furthest a seeded request reaches back, in working days. */
const SEED_WORKING_DAYS = 5;

/** The seed's own clock. Each step of a request moves it forward a little, as an agent and a person would. */
export interface SeedClock {
  current: Date;
}

function advance(clock: SeedClock, ms: number): void {
  clock.current = new Date(clock.current.getTime() + ms);
}

export function startOf(when: SeedTime, end: Date): Date {
  if ("minutesAgo" in when) return new Date(end.getTime() - when.minutesAgo * MINUTE_MS);
  const day = workingDaysBefore(end, SEED_WORKING_DAYS)[when.workingDaysAgo - 1];
  return helsinkiInstant(day, when.at);
}

function chosenOffer(request: SeedRequest, quote: QuoteResponse): SignedOffer | undefined {
  if (request.order === "primary") return quote.primary;
  if (request.order === "alternative") return quote.alternatives[0]?.signed;
  return undefined;
}

/** How long the wholesaler holds the price of the offers the current request gets; the usual 15 minutes when unset. */
export interface OfferHold {
  validityMs?: number;
}

export interface PlayContext {
  gateway: Gateway;
  upstream: SeedUpstream;
  clock: SeedClock;
  hold: OfferHold;
  agentFor(buyerId: string, client: string): Promise<AgentRef>;
}

/** Plays one request through the gateway, the way the buyer's agent and approver would, and returns its order. */
export async function playRequest(request: SeedRequest, start: Date, ctx: PlayContext): Promise<Order | undefined> {
  const { gateway, clock } = ctx;
  clock.current = start;
  const slot = request.weekAhead ? weekAheadSlot(start) : deliverySlot(start, request.missCutoff ?? false);
  ctx.upstream.setSlot(slot);
  ctx.hold.validityMs = request.weekAhead ? slot.orderBy.getTime() - start.getTime() : undefined;
  const agent = await ctx.agentFor(request.buyer, request.client);

  const search = await gateway.searchCatalog(agent, { query: request.query, need: request.quantity, deliverBy: slot.deliverBy, limit: 10 });
  const productId = request.productId ?? search.hits[0]?.product.id;
  if (!productId) return undefined;

  advance(clock, 25 * SECOND_MS);
  const quote = await gateway.requestQuote(agent, {
    lines: [{ productId, quantity: request.quantity }],
    deliverBy: slot.deliverBy,
    intent: request.words,
    matchConfidence: search.interpretation.confidence,
  });
  const offer = chosenOffer(request, quote);
  if (!offer) return undefined;

  advance(clock, 35 * SECOND_MS);
  const { jws: mandateJws } = await gateway.getMandate(request.buyer);
  const order = await gateway.placeOrder(agent, { offerJws: offer.jws, mandateJws, idempotencyKey: randomUUID() });
  if (!request.decision || order.status !== "pending_approval") return order;

  const { afterMinutes, ...decision } = request.decision;
  advance(clock, afterMinutes * MINUTE_MS);
  return gateway.decideApproval(order.id, decision, { buyerId: request.buyer });
}
