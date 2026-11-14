import { describe, expect, it } from "vitest";
import type { AgentTransport } from "@/lib/agent";
import { findCandidates } from "@/lib/agent/find";
import { findSafeSwap } from "@/lib/basket/safe-swap";
import type { Mandate, Product, QuoteRequest, SearchHit } from "@/lib/contracts";
import type { SearchInput } from "@/lib/gateway/types";
import { mandate as policyMandate, product } from "../policy/fixtures";

const SCHOOL: Mandate = policyMandate({
  dietary: { excludeAllergens: ["peanut", "nuts", "sesame"], blockMayContain: true, requiredClaims: [] },
  categories: { allowed: ["bakery", "dairy"] },
} as Partial<Mandate>);

const bread = (id: string, name: string, mayContain: string[] = []): Product =>
  product({ id, name: { en: name, fi: name }, concept: "bread", categoryGroup: "bakery", allergens: { contains: ["gluten", "wheat"], mayContain, freeFrom: [] } });

const BLOCKED = bread("471464", "Dafgårds ciabatta 58g", ["sesame"]);
const TOAST = bread("t1", "Toast bread 750g");
const ROLL = bread("r1", "Fiber ciabatta roll 40x40g", ["milk"]);
const SESAME_ROLL = bread("r2", "Ciabatta sandwich dark", ["sesame"]);

const hit = (p: Product, orderable = true): SearchHit => ({ product: p, offerPreview: { orderable } } as unknown as SearchHit);

/** A wholesaler that answers a search by its words, and quotes every product on time. */
function transport(byQuery: Record<string, SearchHit[]>, searches: SearchInput[] = []): AgentTransport {
  return {
    async searchCatalog(input: SearchInput) {
      searches.push(input);
      return { hits: byQuery[input.query] ?? [], interpretation: { confidence: "high" } } as never;
    },
    async requestQuote(request: QuoteRequest) {
      const [line] = request.lines;
      const offer = { id: `off_${line.productId}`, fulfilment: "full", lines: [{ productId: line.productId, name: line.productId, quantity: 10, availability: { status: "available" }, unitPrice: { amount: 1 } }], totals: { net: { amount: 10 } }, deliverBy: request.deliverBy, deliveryDate: request.deliverBy };
      return { primary: { offer, jws: "jws" }, alternatives: [] } as never;
    },
    getProduct: async () => BLOCKED,
    getMandate: async () => ({ jws: "", mandate: SCHOOL }),
    placeOrder: async () => {
      throw new Error("not here");
    },
    getOrder: async () => {
      throw new Error("not here");
    },
  };
}

describe("a safe swap for a line blocked by an allergen", () => {
  it("searches the line's own words first, so ciabatta rolls get a roll, not toast", async () => {
    const searches: SearchInput[] = [];
    const wholesaler = transport({ "ciabatta rolls": [hit(SESAME_ROLL), hit(ROLL)], bread: [hit(TOAST), hit(ROLL)] }, searches);
    const swap = await findSafeSwap(BLOCKED, { amount: 10, unit: "kg" }, "2026-11-16", SCHOOL, wholesaler, "ciabatta rolls");
    expect(swap?.product.id).toBe(ROLL.id);
    expect(searches.map((search) => search.query)).toEqual(["ciabatta rolls"]);
  });

  it("falls back to the product's kind when nothing in the line's words can come", async () => {
    const wholesaler = transport({ "ciabatta rolls": [hit(ROLL, false)], bread: [hit(TOAST)] });
    const swap = await findSafeSwap(BLOCKED, { amount: 10, unit: "kg" }, "2026-11-16", SCHOOL, wholesaler, "ciabatta rolls");
    expect(swap?.product.id).toBe(TOAST.id);
  });
});

describe("the agent's search", () => {
  it("leaves out what the mandate never allows, a trace too when the mandate blocks traces", async () => {
    const searches: SearchInput[] = [];
    const wholesaler = transport({ "ciabatta rolls": [hit(BLOCKED), hit(SESAME_ROLL), hit(ROLL)] }, searches);
    const parsed = { text: "ciabatta rolls", phrase: "ciabatta rolls", quantity: { amount: 10, unit: "kg" as const }, deliverBy: "2026-11-16", deliverByStated: true, otherClauses: [], waitForPerson: false };
    const found = await findCandidates(parsed, wholesaler, SCHOOL.dietary);
    expect(found.products.map((p) => p.id)).toEqual([ROLL.id]);
    expect(searches[0].filters?.excludeAllergens).toEqual(["peanut", "nuts", "sesame"]);
    // Without a mandate's exclusions (or for a buyer that allows traces) the search is as the wholesaler answered it.
    expect((await findCandidates(parsed, wholesaler)).products).toHaveLength(3);
    expect((await findCandidates(parsed, wholesaler, { excludeAllergens: ["nuts"], blockMayContain: false })).products).toHaveLength(3);
  });
});
