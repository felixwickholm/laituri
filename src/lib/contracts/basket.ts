import { z } from "zod";
import { IsoDate, IsoDateTime } from "./common";

/** How a kitchen counts a line: litres, kilograms or pieces (the wholesaler's sales units). */
export const BasketUnit = z.enum(["l", "kg", "pcs"]);
export type BasketUnit = z.infer<typeof BasketUnit>;

export const BasketQuantity = z.object({
  amount: z.number().positive(),
  unit: BasketUnit,
});
export type BasketQuantity = z.infer<typeof BasketQuantity>;

export const BasketSource = z.enum(["weekly", "menu", "manual", "agent"]);
export type BasketSource = z.infer<typeof BasketSource>;

/** At most this many lines in one basket: a weekly order is 15 to 40. */
export const MAX_BASKET_LINES = 60;

export const BasketLineRequest = z.object({
  words: z.string().trim().min(1).max(200).describe("The line in the kitchen's own words, for example 'lactose-free milk' or '36 kg of eggs'"),
  quantity: BasketQuantity.describe("How much; this wins over a quantity in the words"),
  productId: z.string().min(1).optional().describe("A wholesaler product code the kitchen already chose; the search is skipped"),
});
export type BasketLineRequest = z.infer<typeof BasketLineRequest>;

export const CreateBasketRequest = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  deliverBy: IsoDate.describe("The delivery day every line is for"),
  source: BasketSource.optional().describe("Where the lines came from; manual when not given"),
  menuId: z.string().min(1).max(80).optional(),
  lines: z.array(BasketLineRequest).min(1).max(MAX_BASKET_LINES),
});
export type CreateBasketRequest = z.infer<typeof CreateBasketRequest>;

export const BasketStarted = z.object({ basketId: z.string() });

/** working: the agent is on it. green: ordered alone. orange: waits for a person. red: not ordered. */
export const LineState = z.enum(["working", "green", "orange", "red"]);
export type LineState = z.infer<typeof LineState>;

export const ReasonCode = z.enum([
  "ordered",
  "over_limit",
  "substitute_needs_ok",
  "new_product",
  "partial",
  "request_unclear",
  "price_changed",
  "drift",
  "allergen",
  "no_stock_in_time",
  "cutoff_passed",
  "not_found",
  "refused",
]);
export type ReasonCode = z.infer<typeof ReasonCode>;

/**
 * approve: the existing signed approval of the waiting order. substitute: order a signed alternative instead.
 * quantity: order what is in stock now. skip: leave the line out. handoff: ask a person at Valio Aimo.
 */
export const LineOptionKind = z.enum(["approve", "substitute", "quantity", "skip", "handoff"]);
export type LineOptionKind = z.infer<typeof LineOptionKind>;

export const LineOption = z.object({
  id: z.string(),
  kind: LineOptionKind,
  label: z.string().describe("A button label: 'Approve', 'Take oat drink instead', 'Order 51 now', 'Leave it out', 'Ask Valio Aimo'"),
  detail: z.string().optional().describe("One plain sentence on what changes"),
  net: z.number().optional().describe("Net EUR this option orders, when it orders something"),
});
export type LineOption = z.infer<typeof LineOption>;

export const LineHistory = z.object({
  timesOrdered: z.number().int().describe("Confirmed orders of this product by this buyer before this line"),
  lastOrdered: IsoDate.optional().describe("The day of the latest of them"),
});
export type LineHistory = z.infer<typeof LineHistory>;

export const LineResolution = z.object({
  optionId: z.string(),
  by: z.string().describe("The person who chose the option"),
  at: IsoDateTime,
  sentence: z.string(),
});

export const BasketLine = z.object({
  id: z.string(),
  words: z.string(),
  asked: z.object({ amount: z.number(), unit: z.string() }),
  state: LineState,
  reasonCode: ReasonCode.optional().describe("Absent while the line is working"),
  reason: z.string().describe("At most 14 plain words for a kitchen manager"),
  product: z.object({ id: z.string(), name: z.string() }).optional(),
  packs: z.string().optional().describe("What is ordered in the buyer's unit, for example '1,000 x 1 l = 1,000 l'"),
  net: z.number().optional().describe("Net EUR of the line's order"),
  orderId: z.string().optional(),
  offerId: z.string().optional(),
  history: LineHistory.optional(),
  options: z.array(LineOption).optional().describe("What a person can do on an orange or red line"),
  resolved: LineResolution.optional(),
});
export type BasketLine = z.infer<typeof BasketLine>;

export const BasketTotals = z.object({
  lines: z.number().int(),
  green: z.number().int(),
  orange: z.number().int(),
  red: z.number().int(),
  working: z.number().int(),
  netOrdered: z.number().describe("Net EUR of confirmed lines"),
  netWaiting: z.number().describe("Net EUR of lines whose order waits for a person"),
  secondsTaken: z.number().optional().describe("From start to the last line, once the basket is done"),
  upstreamCalls: z.number().int().optional().describe("Requests this basket's lines sent the wholesaler's price and availability APIs; cached answers are not asked again"),
  productsAsked: z.number().int().optional().describe("Product ids those requests carried, out of the whole catalogue"),
  minutesByHand: z.number().describe(
    "Assumed time to do the same lines by hand: one minute per line to find, check and add each product in a webshop. An assumption, not a measurement",
  ),
});
export type BasketTotals = z.infer<typeof BasketTotals>;

export const Basket = z.object({
  id: z.string(),
  title: z.string(),
  source: BasketSource,
  menuId: z.string().optional(),
  buyer: z.object({ id: z.string(), name: z.string() }),
  deliverBy: IsoDate,
  createdAt: IsoDateTime,
  status: z.enum(["running", "done"]),
  lines: z.array(BasketLine),
  totals: BasketTotals,
  summary: z.string().describe("One plain sentence, for example '17 of 20 lines ordered. 2 need you. 1 is blocked.'"),
  seeded: z.literal(true).optional().describe("Demo history written at start-up through the real order path"),
});
export type Basket = z.infer<typeof Basket>;

export const BasketList = z.object({ baskets: z.array(Basket) });

export const ResolveLineRequest = z.object({ optionId: z.string().min(1) });
export type ResolveLineRequest = z.infer<typeof ResolveLineRequest>;

export const WeeklyDraftLine = z.object({
  words: z.string(),
  quantity: BasketQuantity,
  lastWeek: BasketQuantity.optional(),
  change: z.enum(["same", "more", "less", "new"]),
  note: z.string().optional(),
});
export type WeeklyDraftLine = z.infer<typeof WeeklyDraftLine>;

export const WeeklyDraft = z.object({
  title: z.string(),
  deliverBy: IsoDate,
  cutoff: IsoDateTime.describe("When orders for the delivery day close"),
  lines: z.array(WeeklyDraftLine),
  drift: z.array(z.object({ sentence: z.string() })).describe("How the standing order moved over the last weeks"),
});
export type WeeklyDraft = z.infer<typeof WeeklyDraft>;

/** A basket placed by an agent over MCP: the result once every line finished, or as far as it got in the time allowed. */
export const PlaceBasketInput = CreateBasketRequest.omit({ source: true, menuId: true });
