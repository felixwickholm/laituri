import "../store/temp-data-dir";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "@/lib/contracts";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_CATALOG = path.join(process.cwd(), "fixtures", "upstream", "catalog.json");

const { DEMO_AGENT, gatewayTransport, runPurchase } = await import("@/lib/agent");
const { gateway } = await import("@/lib/gateway");

const QUIET = { note: () => undefined, pause: async () => undefined };
/** Valio skimmed milk 1 l ESL: ordinary milk, not lactose-free, in stock in the recording. */
const ORDINARY_MILK = "469477";

beforeEach(async () => {
  await gateway().reset();
});

async function purchase(words: string): Promise<{ status: string; order?: Order; summary: string }> {
  const result = await runPurchase(words, gatewayTransport(DEMO_AGENT), QUIET);
  const order = result.orderId ? await gateway().getOrder(DEMO_AGENT, result.orderId) : undefined;
  return { status: result.status, order, summary: result.summary };
}

const matchCheck = (order: Order | undefined) => order?.decision.checks.find((check) => check.rule === "match.confidence");

describe("the wholesaler compares the buyer's words with the offer", () => {
  it("does not confirm an order the words said to hold: 'do not order until I approve'", async () => {
    const { status, order, summary } = await purchase("200 litres of lactose-free milk by Monday, do not order until I approve");
    expect(order?.status).toBe("pending_approval");
    expect(status).toBe("waiting");
    expect(matchCheck(order)).toMatchObject({ status: "ask" });
    expect(matchCheck(order)?.message).toMatch(/approve/i);
    expect(summary).toMatch(/approve/i);
    expect(order?.offer.requestCheck).toContainEqual(expect.objectContaining({ requirement: "approval", result: "unmet" }));
  });

  it("does not confirm an €88 order against 'under 50 euros'", async () => {
    const { order } = await purchase("80 litres of lactose-free milk by Monday, under 50 euros");
    expect(order?.offer.totals.gross.amount).toBeGreaterThan(50);
    expect(order?.status).toBe("pending_approval");
    expect(matchCheck(order)?.message).toMatch(/€50\.00/);
    expect(order?.offer.requestCheck).toContainEqual(expect.objectContaining({ requirement: "budget", result: "unmet", asked: "at most €50.00" }));
  });

  it("refuses one litre of ordinary milk offered for 1,000 litres of lactose-free milk, whatever confidence the agent claims", async () => {
    const agent = DEMO_AGENT;
    const { primary } = await gateway().requestQuote(agent, {
      lines: [{ productId: ORDINARY_MILK, quantity: { amount: 1, unit: "sales_unit" } }],
      deliverBy: "2026-11-16",
      intent: "1,000 litres of lactose-free milk by Monday",
      matchConfidence: "high",
    });
    expect(primary.offer.matchConfidence).toBe("low");
    const checks = primary.offer.requestCheck ?? [];
    expect(checks).toContainEqual(expect.objectContaining({ requirement: "claim", result: "unmet", certain: true }));
    expect(checks).toContainEqual(expect.objectContaining({ requirement: "quantity", result: "unmet", certain: true }));

    const { jws: mandateJws } = await gateway().getMandate();
    const order = await gateway().placeOrder(agent, { offerJws: primary.jws, mandateJws, idempotencyKey: "fidelity-ordinary-milk" });
    expect(order.status).toBe("blocked");
    expect(matchCheck(order)).toMatchObject({ status: "block" });
    expect(matchCheck(order)?.message).toMatch(/lactose-free/);
  });

  it("reads the Finnish forms of both instructions", async () => {
    const { order } = await purchase("80 litraa laktoositonta maitoa maanantaiksi alle 50 euroa, älä tilaa ennen kuin hyväksyn");
    expect(order?.status).toBe("pending_approval");
    const requirements = (order?.offer.requestCheck ?? []).filter((check) => check.result !== "met").map((check) => check.requirement);
    expect(requirements).toEqual(expect.arrayContaining(["budget", "approval"]));
  });

  it("asks a person about words it does not understand instead of ignoring them", async () => {
    const { order } = await purchase("200 litres of lactose-free milk by Monday from a farm in Lapland");
    expect(order?.status).toBe("pending_approval");
    expect(order?.offer.matchConfidence).toBe("low");
    expect(order?.offer.requestCheck).toContainEqual(expect.objectContaining({ requirement: "wording", result: "unchecked" }));
  });

  it("still confirms a plain request that the offer meets in every respect", async () => {
    const { order } = await purchase("1,000 litres of lactose-free milk by Monday");
    expect(order?.status).toBe("confirmed");
    expect((order?.offer.requestCheck ?? []).map((check) => [check.requirement, check.result])).toEqual([
      ["product", "met"],
      ["claim", "met"],
      ["quantity", "met"],
      ["date", "met"],
    ]);
  });
});
