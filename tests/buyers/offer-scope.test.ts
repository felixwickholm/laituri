import { AGENT_TOKEN, jsonRequest, params } from "../http/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as offer from "@/app/api/v1/offers/[id]/route";
import * as quotes from "@/app/api/v1/quotes/route";
import type { QuoteResponse, SignedOffer } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { MILK } from "@/lib/openapi/examples";

const KAISLA_TOKEN = "demo-kaisla-token";
const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function quoteFor(token: string): Promise<QuoteResponse> {
  const request = { lines: [{ productId: MILK.productId, quantity: { amount: 10, unit: "l" } }], deliverBy: MILK.deliverBy };
  const response = await quotes.POST(jsonRequest("/api/v1/quotes", { body: request, headers: bearer(token) }));
  return (await response.json()) as QuoteResponse;
}

function readOffer(id: string, headers: Record<string, string> = {}): Promise<Response> {
  return offer.GET(jsonRequest(`/api/v1/offers/${id}`, { headers }), params({ id }));
}

describe.runIf(hasFixtures)("offer lookup by an agent token", () => {
  beforeEach(async () => {
    await gateway().reset();
  });

  it("answers another buyer's offer as not found, exactly like a missing one", async () => {
    const { primary } = await quoteFor(AGENT_TOKEN);
    const other = await readOffer(primary.offer.id, bearer(KAISLA_TOKEN));
    const missing = await readOffer("off_never_issued", bearer(KAISLA_TOKEN));
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    const [otherBody, missingBody] = (await Promise.all([other.json(), missing.json()])) as { code: string; detail: string }[];
    expect(otherBody.code).toBe(missingBody.code);
    expect(otherBody.detail).toBe(`Offer ${primary.offer.id} does not exist.`);
  });

  it("returns the buyer's own offer to its token, and nothing to a reader without any credential", async () => {
    const { primary } = await quoteFor(AGENT_TOKEN);
    const own = await readOffer(primary.offer.id, bearer(AGENT_TOKEN));
    expect(own.status).toBe(200);
    expect(((await own.json()) as SignedOffer).jws).toBe(primary.jws);
    const open = await readOffer(primary.offer.id);
    expect(open.status).toBe(401);
  });
});
