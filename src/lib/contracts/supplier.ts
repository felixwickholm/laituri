import { z } from "zod";
import { IsoDate, IsoDateTime, Quantity } from "./common";
import { RuleId } from "./policy";

/** The wholesaler's view of agent trade. It holds what reached the wholesaler, never a buyer's mandate terms. */

const Party = z.object({ id: z.string(), name: z.string() });

/**
 * How the wholesaler answered one request. met_in_full: on time and in full. met_with_alternative: only a signed
 * alternative covers it. short_stock: not enough stock and no alternative. cutoff_passed: the order cut-off for the
 * date has passed. not_found: nothing in the catalogue matches. low_confidence: products exist but the match is uncertain.
 */
export const DemandOutcome = z.enum(["met_in_full", "met_with_alternative", "short_stock", "cutoff_passed", "not_found", "low_confidence"]);
export type DemandOutcome = z.infer<typeof DemandOutcome>;

export const OrderOutcome = z.enum(["confirmed_auto", "confirmed_after_approval", "waiting", "rejected", "blocked", "refused"]);
export type OrderOutcome = z.infer<typeof OrderOutcome>;

export const OutcomeCounts = z.object({
  confirmed_auto: z.number().int(),
  confirmed_after_approval: z.number().int(),
  waiting: z.number().int(),
  rejected: z.number().int(),
  blocked: z.number().int().describe("Stopped by one of the buyer's mandate rules"),
  refused: z.number().int().describe("Refused as invalid: a signature did not verify, or the offer or mandate was not issued here"),
});
export type OutcomeCounts = z.infer<typeof OutcomeCounts>;

export const ConnectedAgent = z.object({
  agent: Party,
  buyer: Party.optional(),
  clients: z.array(z.string()).describe("Client applications seen for this agent, most recent first"),
  firstSeen: IsoDateTime,
  lastSeen: IsoDateTime,
  calls: z.number().int(),
  quotes: z.number().int(),
  orders: OutcomeCounts,
  confirmedNet: z.number().describe("Net EUR of confirmed orders"),
  status: z.enum(["active", "idle", "suspended"])
    .describe("suspended: the wholesaler refuses every call by this agent; active: a call in the last 24 hours; else idle"),
  suspendedAt: IsoDateTime.optional().describe("When the wholesaler suspended the agent; set while suspended"),
  reason: z.string().optional().describe("Why the wholesaler suspended the agent, when it said"),
});
export type ConnectedAgent = z.infer<typeof ConnectedAgent>;

/** The wholesaler's stop on one agent: while it holds, every call by the agent is refused. */
export const AgentSuspension = z.object({
  agent: Party,
  buyer: Party.optional(),
  suspendedAt: IsoDateTime,
  reason: z.string().optional(),
});
export type AgentSuspension = z.infer<typeof AgentSuspension>;

export const SuspensionRequest = z.object({
  suspended: z.boolean().describe("true suspends the agent, false resumes it"),
  reason: z.string().trim().min(1).max(300).optional().describe("Why, in one sentence; kept in the signed audit entry"),
});
export type SuspensionRequest = z.infer<typeof SuspensionRequest>;

export const SuspensionState = z.object({
  agent: Party,
  buyer: Party.optional(),
  suspended: z.boolean(),
  suspendedAt: IsoDateTime.optional().describe("Set while suspended"),
  reason: z.string().optional(),
});
export type SuspensionState = z.infer<typeof SuspensionState>;

export const ConceptDemand = z.object({
  concept: z.string(),
  requests: z.number().int(),
  quantity: z.array(Quantity).describe("Total quantity asked, one entry per unit"),
});
export type ConceptDemand = z.infer<typeof ConceptDemand>;

export const UnmetReason = DemandOutcome.extract(["short_stock", "cutoff_passed", "not_found"]);
export type UnmetReason = z.infer<typeof UnmetReason>;

export const UnmetRequest = z.object({
  requestId: z.string(),
  at: IsoDateTime,
  buyer: Party.optional(),
  agent: Party,
  client: z.string(),
  words: z.string().optional().describe("The buyer's words"),
  concept: z.string().optional(),
  quantity: Quantity.optional(),
  deliverBy: IsoDate.optional(),
  reason: UnmetReason,
  reasonText: z.string(),
  estimatedLostNet: z.number().optional().describe("Net EUR the wholesaler could not sell; absent when no price is known"),
  seeded: z.literal(true).optional(),
});
export type UnmetRequest = z.infer<typeof UnmetRequest>;

export const OfferStats = z.object({
  signed: z.number().int().describe("Every signed offer, primary or alternative"),
  ordered: z.number().int(),
  expiredUnused: z.number().int(),
  open: z.number().int(),
  conversionRate: z.number().describe("ordered / signed, 0 to 1"),
  medianSecondsToOrder: z.number().optional(),
});
export type OfferStats = z.infer<typeof OfferStats>;

const Tally = z.object({ count: z.number().int(), net: z.number() });

export const OrderStats = z.object({
  total: Tally,
  byOutcome: z.object({
    confirmed_auto: Tally,
    confirmed_after_approval: Tally,
    waiting: Tally,
    rejected: Tally,
    blocked: Tally,
    refused: Tally,
  }),
  medianSecondsRequestToConfirmed: z.number().int().optional().describe(
    "Median seconds from the first search of a request (its first quote when it began with one) to an order that " +
      "confirmed without a person; an order on an alternative offer counts from the request whose quote issued it. " +
      "Only live requests and orders count: seeded demo history runs on a backdated clock, so it is left out. " +
      "Absent until one such order exists.",
  ),
});
export type OrderStats = z.infer<typeof OrderStats>;

export const RuleStat = z.object({
  rule: RuleId,
  title: z.string(),
  tier: z.enum(["ask", "block"]),
  count: z.number().int(),
});
export type RuleStat = z.infer<typeof RuleStat>;

export const DailyPoint = z.object({
  date: IsoDate.describe("Calendar date in Helsinki"),
  requests: z.number().int().describe("Requests that started that day: a search, or a quote that began one"),
  ordered: z.number().int().describe("Of that day's requests, those that led to at least one order; never more than requests"),
  orders: z.number().int().describe("Orders placed that day; one request can lead to several"),
  confirmed: z.number().int().describe("Orders placed that day that are confirmed"),
  confirmedNet: z.number().describe("Net EUR of the orders placed that day that are confirmed"),
});
export type DailyPoint = z.infer<typeof DailyPoint>;

export const SupplierOverview = z.object({
  generatedAt: IsoDateTime,
  includesSeeded: z.boolean().describe("True when part of the figures comes from seeded demo history"),
  agents: z.array(ConnectedAgent),
  demand: z.object({ requests: z.number().int(), topConcepts: z.array(ConceptDemand) }),
  unmet: z.array(UnmetRequest).describe("Requests not met in full and on time, or that found nothing; newest first"),
  offers: OfferStats,
  orders: OrderStats,
  rules: z.array(RuleStat).describe("Mandate rules that held or stopped orders, most frequent first"),
  daily: z.array(DailyPoint).describe("The last 7 days, oldest first"),
  baskets: z.object({
    count: z.number().int().describe("Baskets the buyers' agents worked; each line is also its own request, offer and order above"),
    lines: z.number().int(),
    autoShare: z.number().describe("Share of finished lines ordered without a person, 0 to 1"),
  }).optional().describe("Always present in answers from this version; optional for overviews recorded before baskets"),
  handoffs: z.object({ open: z.number().int().describe("Questions from kitchens that wait for a person at Valio Aimo") })
    .optional().describe("Always present in answers from this version"),
});
export type SupplierOverview = z.infer<typeof SupplierOverview>;
