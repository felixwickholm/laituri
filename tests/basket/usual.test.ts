import { describe, expect, it } from "vitest";
import type { AgentTransport } from "@/lib/agent";
import { workLine, type LineContext } from "@/lib/basket/line";
import type { StoredBasket, StoredLine } from "@/lib/basket/types";
import type { Order, PlaceOrderRequest, Product, QuoteRequest, SearchHit } from "@/lib/contracts";
import type { SearchInput } from "@/lib/gateway/types";
import { mandate, product } from "../policy/fixtures";

const USUAL = product({ id: "463971", name: { en: "Arla Pro 1 kg Cheddar cheese slices", fi: "Arla Pro Cheddar" }, concept: "cheese", categoryGroup: "cheese" });
const OTHER = product({ id: "468232", name: { en: "Valio Burger slices cheddar e1 kg", fi: "Valio Burger cheddar" }, concept: "cheese", categoryGroup: "cheese" });
const WORDS = "cheddar cheese slices";

function offerOf(productId: string, deliverBy: string) {
  return {
    id: `off_${productId}`,
    fulfilment: "full",
    deliverBy,
    lines: [{ productId, name: productId, quantity: 15, categoryGroup: "cheese", availability: { status: "available", deliveryDate: deliverBy }, unitPrice: { amount: 10 }, content: { amount: 15, unit: "kg" } }],
    totals: { net: { amount: 150 } },
  };
}

/** A wholesaler that knows the two products, searches the other one first, and confirms every order. */
function wholesaler(calls: string[], unknown: string[] = []): AgentTransport {
  const byId = new Map<string, Product>([USUAL, OTHER].map((p) => [p.id, p]));
  return {
    async getProduct(id: string) {
      calls.push(`product ${id}`);
      if (unknown.includes(id) || !byId.has(id)) throw new Error("not found");
      return byId.get(id)!;
    },
    async searchCatalog(input: SearchInput) {
      calls.push(`search ${input.query}`);
      return { hits: [{ product: OTHER } as SearchHit], interpretation: { confidence: "high" } } as never;
    },
    async requestQuote(request: QuoteRequest) {
      calls.push(`quote ${request.lines[0].productId}`);
      return { primary: { offer: offerOf(request.lines[0].productId, request.deliverBy), jws: `jws_${request.lines[0].productId}` }, alternatives: [] } as never;
    },
    getMandate: async () => ({ jws: "mandate", mandate: mandate() }),
    async placeOrder(request: PlaceOrderRequest) {
      const productId = request.offerJws.replace("jws_", "");
      return { id: `ord_${productId}`, status: "confirmed", buyer: { id: "b", name: "B" }, offer: offerOf(productId, "2026-11-16"), decision: { outcome: "auto_approved", checks: [] } } as unknown as Order;
    },
    getOrder: async () => {
      throw new Error("not here");
    },
  };
}

const line = (): StoredLine => ({
  id: "line_1",
  words: WORDS,
  asked: { amount: 15, unit: "kg" },
  state: "working",
  reason: "Looking for it.",
  request: { words: WORDS, quantity: { amount: 15, unit: "kg" } },
  held: {},
});

function basket(lines: StoredLine[], createdAt: string): StoredBasket {
  return {
    id: `bsk_${createdAt}`,
    title: "Weekly order",
    source: "weekly",
    buyer: { id: "b", name: "B" },
    deliverBy: "2026-11-16",
    createdAt,
    status: "done",
    lines,
    agent: { id: "agent", name: "Agent", buyer: { id: "b", name: "B" } },
    usage: { calls: 0, productsAsked: 0 },
  };
}

const lastWeek = basket([{ ...line(), state: "green", reason: "Ordered.", product: { id: USUAL.id, name: "Arla Pro Cheddar" } }], "2026-11-05T07:30:00.000Z");
const thisWeek = basket([line()], "2026-11-12T07:30:00.000Z");
const context = (transport: AgentTransport): LineContext => ({ transport, pause: async () => undefined, orders: async () => [], previous: lastWeek, weeks: [lastWeek] });

describe("a standing-order line", () => {
  it("orders last week's product without searching, even when the search ranks another first", async () => {
    const calls: string[] = [];
    const outcome = await workLine(line(), thisWeek, context(wholesaler(calls)));
    expect(outcome).toMatchObject({ state: "green", product: { id: USUAL.id } });
    expect(calls.some((call) => call.startsWith("search"))).toBe(false);
  });

  it("searches when last week's product cannot be quoted", async () => {
    const calls: string[] = [];
    const outcome = await workLine(line(), thisWeek, context(wholesaler(calls, [USUAL.id])));
    expect(outcome).toMatchObject({ state: "green", product: { id: OTHER.id } });
    expect(calls).toContain(`search ${WORDS}`);
  });

  it("searches as before in a basket that is not a standing order", async () => {
    const calls: string[] = [];
    const outcome = await workLine(line(), { ...thisWeek, source: "manual" }, context(wholesaler(calls)));
    expect(outcome.product?.id).toBe(OTHER.id);
  });
});
