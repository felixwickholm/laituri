import { describe, expect, it } from "vitest";
import type { OfferPreview, QuoteResponse, SearchHit, SearchResponse } from "@/lib/contracts";
import { assessQuote, assessSearch, continuedRequest, logDemand, type DemandInput, type DemandRecord } from "@/lib/demand";
import { memoryStore } from "../support/fakes";
import { line, offer, product } from "../policy/fixtures";

const signed = (overrides: Parameters<typeof offer>[0] = {}, lines = [line()]) => ({ offer: offer(overrides, lines), jws: "a.b.c" });

function quoteResponse(primary: ReturnType<typeof signed>, alternatives = 0): QuoteResponse {
  return { primary, alternatives: Array.from({ length: alternatives }, () => ({ tier: "good" as const, meaning: "Cheapest like for like.", tradeoff: "Same type.", signed: signed() })) };
}

function preview(patch: Partial<OfferPreview> = {}): OfferPreview {
  return {
    unitsNeeded: 100,
    unitPrice: { amount: 2, currency: "EUR" },
    availability: { status: "available", available: 500 },
    orderable: true,
    ...patch,
  };
}

function searchResponse(hits: SearchHit[], confidence: "high" | "medium" | "low" = "high"): SearchResponse {
  return { query: "milk", interpretation: { concept: "milk", claims: [], confidence }, hits };
}

const hit = (offerPreview?: OfferPreview): SearchHit => ({ product: product(), score: 1, matched: [], facts: { labels: [] }, offerPreview });

describe("assessing a quote", () => {
  it("is met in full when the offer is full, and only low confidence when the match is uncertain", () => {
    expect(assessQuote(quoteResponse(signed()))).toEqual({ outcome: "met_in_full" });
    expect(assessQuote(quoteResponse(signed({ matchConfidence: "low" })))).toEqual({ outcome: "low_confidence" });
  });

  it("is met with an alternative when only a signed alternative covers it", () => {
    const partial = signed({ fulfilment: "partial" }, [line({ quantity: 51, availability: { status: "partial", requested: 200, available: 51 } })]);
    expect(assessQuote(quoteResponse(partial, 2))).toEqual({ outcome: "met_with_alternative" });
  });

  it("reports short stock with the value of the units it could not offer", () => {
    const partial = signed({ fulfilment: "partial" }, [
      line({ quantity: 51, unitPrice: { amount: 2.57, currency: "EUR" }, availability: { status: "partial", requested: 200, available: 51 } }),
    ]);
    expect(assessQuote(quoteResponse(partial))).toEqual({ outcome: "short_stock", lostNet: 382.93 });
  });

  it("reports a passed cut-off with the whole line's value", () => {
    const late = signed({ fulfilment: "unavailable" }, [
      line({ quantity: 0, unitPrice: { amount: 1.01, currency: "EUR" }, availability: { status: "cutoff_passed", requested: 300, available: 300 } }),
    ]);
    expect(assessQuote(quoteResponse(late))).toEqual({ outcome: "cutoff_passed", lostNet: 303 });
  });
});

describe("assessing a search", () => {
  it("finds nothing, or an uncertain match", () => {
    expect(assessSearch(searchResponse([]))).toEqual({ outcome: "not_found" });
    expect(assessSearch(searchResponse([hit()], "low"))).toEqual({ outcome: "low_confidence" });
  });

  it("is met when any hit is orderable, or when the wholesaler gave no previews", () => {
    expect(assessSearch(searchResponse([hit()]))).toEqual({ outcome: "met_in_full" });
    expect(assessSearch(searchResponse([hit(preview({ orderable: false })), hit(preview())]))).toEqual({ outcome: "met_in_full" });
  });

  it("explains a miss from the best hit", () => {
    const short = preview({ orderable: false, availability: { status: "partial", available: 40 } });
    expect(assessSearch(searchResponse([hit(short)]))).toEqual({ outcome: "short_stock", lostNet: 120 });
    const closed = preview({ orderable: false, availability: { status: "cutoff_passed", available: 500 } });
    expect(assessSearch(searchResponse([hit(closed)]))).toEqual({ outcome: "cutoff_passed", lostNet: 200 });
  });
});

describe("the request log", () => {
  const agent = { id: "agent:kaisla-menu-planner", name: "Kaisla menu planner" };
  const input = (patch: Partial<DemandInput> = {}): DemandInput => ({
    kind: "search", agent, client: "ChatGPT", words: "lactose-free milk", concept: "milk", productIds: ["464306", "463335"],
    outcome: "met_in_full", ...patch,
  });
  const earlier = (patch: Partial<DemandRecord> = {}): DemandRecord => ({
    id: "dem_1", requestId: "req_1", at: "2026-11-14T07:00:00.000Z", ...input(), ...patch,
  });
  const at = (minutes: number) => new Date(Date.parse("2026-11-14T07:00:00.000Z") + minutes * 60_000);

  it("joins a quote to the same caller's recent request for a product it found or the same product type", () => {
    expect(continuedRequest(input({ kind: "quote", concept: undefined, productIds: ["463335"] }), [earlier()], at(2))).toBe("req_1");
    expect(continuedRequest(input({ kind: "quote", productIds: ["469363"] }), [earlier()], at(2))).toBe("req_1");
  });

  it("starts a new request for a search, a later quote, another product type or another caller", () => {
    expect(continuedRequest(input(), [earlier()], at(2))).toBeUndefined();
    expect(continuedRequest(input({ kind: "quote" }), [earlier()], at(16))).toBeUndefined();
    expect(continuedRequest(input({ kind: "quote", concept: "butter", productIds: ["464411"] }), [earlier()], at(2))).toBeUndefined();
    const nothingFound = earlier({ concept: undefined, productIds: [], outcome: "not_found" });
    expect(continuedRequest(input({ kind: "quote", productIds: ["464306"] }), [nothingFound], at(2))).toBeUndefined();
    expect(continuedRequest(input({ kind: "quote", client: "Cursor" }), [earlier()], at(2))).toBeUndefined();
  });

  it("appends records with an id, a time and a request id", async () => {
    const store = memoryStore();
    const now = () => at(0);
    const search = await logDemand(input(), { store, now });
    const quote = await logDemand(input({ kind: "quote", words: "300 litres of lactose-free milk" }), { store, now });
    expect(search).toMatchObject({ id: expect.stringMatching(/^dem_/), requestId: expect.stringMatching(/^req_/), at: "2026-11-14T07:00:00.000Z" });
    expect(quote.requestId).toBe(search.requestId);
    expect(search.seeded).toBeUndefined();
    expect(await store.requests.list()).toEqual([search, quote]);
  });
});
