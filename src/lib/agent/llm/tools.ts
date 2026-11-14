import { randomUUID } from "node:crypto";
import { z } from "zod";
import { IsoDate, Quantity, QuoteLineRequest, type Mandate, type Order, type QuoteRequest, type SignedOffer } from "@/lib/contracts";
import { searchText } from "@/lib/mcp/summaries";
import { shortDay } from "../dates";
import { offerSubject } from "../purchase";
import type { AgentTransport } from "../types";
import { euro } from "../words";
import type { ToolCall, ToolSpec } from "./types";

/** What one run remembers between tool calls. Signed offers stay here; the model only sees their ids. */
export interface ToolSession {
  transport: AgentTransport;
  request: string;
  offers: Map<string, SignedOffer>;
  confidence?: QuoteRequest["matchConfidence"];
}

export type ToolEffect =
  | { kind: "reply"; content: string; note?: string }
  | { kind: "error"; content: string }
  | { kind: "ordered"; order: Order; mandate: Mandate; offer: SignedOffer }
  | { kind: "ask"; question: string }
  | { kind: "stop"; reason: string };

interface PurchaseTool<I extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  run(input: z.infer<I>, session: ToolSession): Promise<ToolEffect>;
}

type AnyTool = PurchaseTool<z.ZodType>;

const define = <I extends z.ZodType>(tool: PurchaseTool<I>): AnyTool => tool as unknown as AnyTool;

function offerText(label: string, signed: SignedOffer, tradeoff?: string): string {
  const { offer } = signed;
  const when = offer.deliveryDate ? `delivery ${shortDay(offer.deliveryDate)}` : "no delivery date";
  const notes = offer.notes.length ? ` ${offer.notes.join(" ")}` : "";
  const why = tradeoff ? ` ${tradeoff}` : "";
  return `${label} offer ${offer.id}: ${offerSubject(offer)}, ${offer.fulfilment}, net ${euro(offer.totals.net.amount)}, ${when}.${notes}${why}`;
}

function mandateSummary(mandate: Mandate): string {
  return [
    `You may order alone up to ${euro(mandate.limits.perOrder.amount, true)} net per order and ${euro(mandate.limits.perWeek.amount, true)} per week.`,
    `Allowed categories: ${mandate.categories.allowed.join(", ")}.`,
    `Substitutes: ${mandate.substitution.policy}, at most ${mandate.substitution.maxPriceIncreasePct} % dearer.`,
    `Partial delivery ${mandate.delivery.allowPartial ? "allowed" : "not allowed"}.`,
  ].join("\n");
}

const TOOLS: AnyTool[] = [
  define({
    name: "search_catalog",
    description:
      "Search the wholesaler catalogue (Finnish, Swedish or English). Returns ranked products with indicative price, stock, " +
      "delivery date and pack maths when need and deliverBy are given, and a match confidence.",
    input: z.object({
      query: z.string().min(1).max(300).describe("The product in the buyer's words, without quantity or date"),
      need: Quantity.optional().describe("How much is needed"),
      deliverBy: IsoDate.optional(),
    }),
    async run(input, session) {
      const response = await session.transport.searchCatalog({ ...input, limit: 8 });
      session.confidence = response.interpretation.confidence;
      return { kind: "reply", content: searchText(response) };
    },
  }),
  define({
    name: "request_quote",
    description:
      "Get a wholesaler-signed fixed-price offer for products and quantities, plus signed alternatives when the request " +
      "cannot be met in full and on time. Returns offer ids for place_order.",
    input: z.object({
      lines: z.array(QuoteLineRequest).min(1).max(5),
      deliverBy: IsoDate.describe("Latest acceptable delivery date"),
    }),
    async run(input, session) {
      const quote = await session.transport.requestQuote({ ...input, intent: session.request, matchConfidence: session.confidence });
      const all = [quote.primary, ...quote.alternatives.map((alternative) => alternative.signed)];
      for (const signed of all) session.offers.set(signed.offer.id, signed);
      const { offer } = quote.primary;
      const lines = [
        offerText("Primary", quote.primary),
        ...quote.alternatives.map((alternative) => offerText(`Alternative (${alternative.tier})`, alternative.signed, alternative.tradeoff)),
      ];
      return {
        kind: "reply",
        content: lines.join("\n"),
        note: `Offer signed by ${offer.issuer}: ${offerSubject(offer)}, ${euro(offer.totals.gross.amount)} with VAT.`,
      };
    },
  }),
  define({
    name: "get_mandate",
    description: "Read the buyer's mandate: what you may order alone, and what needs a person.",
    input: z.object({}),
    async run(_input, session) {
      const { mandate } = await session.transport.getMandate();
      return { kind: "reply", content: mandateSummary(mandate) };
    },
  }),
  define({
    name: "place_order",
    description:
      "Order one offer from request_quote. The signed offer and the mandate are sent unchanged. " +
      "The result is confirmed, waiting for the buyer's approver, or blocked. Call it once.",
    input: z.object({ offerId: z.string().min(1).describe("An offer id from request_quote") }),
    async run(input, session) {
      const signed = session.offers.get(input.offerId);
      if (!signed) return { kind: "error", content: `There is no offer ${input.offerId}. Use an offer id from request_quote.` };
      const { jws: mandateJws, mandate } = await session.transport.getMandate();
      const order = await session.transport.placeOrder({ offerJws: signed.jws, mandateJws, idempotencyKey: randomUUID() });
      return { kind: "ordered", order, mandate, offer: signed };
    },
  }),
  define({
    name: "ask_buyer",
    description: "Ask the buyer one short question when the product or quantity is unclear. Ends the run without an order.",
    input: z.object({ question: z.string().min(1).max(300) }),
    run: async (input) => ({ kind: "ask", question: input.question }),
  }),
  define({
    name: "end_without_order",
    description: "End the run when nothing suitable can be ordered. Say why in one sentence.",
    input: z.object({ reason: z.string().min(1).max(300) }),
    run: async (input) => ({ kind: "stop", reason: input.reason }),
  }),
];

/** The tools as JSON Schema, the form both providers take. */
export function toolSpecs(): ToolSpec[] {
  return TOOLS.map((tool) => {
    const parameters = { ...(z.toJSONSchema(tool.input, { io: "input" }) as Record<string, unknown>) };
    delete parameters.$schema;
    return { name: tool.name, description: tool.description, parameters };
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Validates the model's arguments and runs one tool. Failures come back as errors the model can read and correct. */
export async function runTool(call: ToolCall, session: ToolSession): Promise<ToolEffect> {
  const tool = TOOLS.find((candidate) => candidate.name === call.name);
  if (!tool) return { kind: "error", content: `There is no tool called ${call.name}.` };
  const parsed = tool.input.safeParse(call.input ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(input)"}: ${issue.message}`);
    return { kind: "error", content: `Invalid arguments. ${problems.join("; ")}` };
  }
  try {
    return await tool.run(parsed.data, session);
  } catch (error) {
    return { kind: "error", content: messageOf(error) };
  }
}
