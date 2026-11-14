import { describe, expect, it } from "vitest";
import { flowSteps, labelWord, whyThisProduct } from "@/lib/console/format/flow";
import { historyItems, lightCounts, matchesLight, orderLight, orderSentence } from "@/lib/console/history";
import { basketOf, blockedOrder, pendingOrder } from "./fixtures";

describe("one list of baskets and single orders", () => {
  it("leaves out the orders a basket placed, newest first", () => {
    const basket = basketOf(["green", "orange"]);
    const inBasket = pendingOrder({ id: "ord_b1", status: "confirmed" });
    const single = pendingOrder({ id: "ord_single", createdAt: "2026-11-14T09:00:00.000Z" });
    const items = historyItems([basket], [inBasket, single]);
    expect(items.map((item) => item.id)).toEqual(["ord_single", "bsk_1"]);
  });

  it("filters by the lines' colours", () => {
    const items = historyItems([basketOf(["green", "orange"])], [blockedOrder()]);
    expect(lightCounts(items)).toEqual({ green: 1, orange: 1, red: 1, refused: 0 });
    expect(items.filter((item) => matchesLight(item, "red")).map((item) => item.kind)).toEqual(["order"]);
  });

  it("names how a single order ended, by role", () => {
    const approved = pendingOrder({ status: "confirmed", approval: { decidedBy: { id: "u", name: "Demo" }, decision: "approved", decidedAt: "2026-11-14T07:05:00.000Z", jws: "a.b.c" } });
    expect(orderLight(approved)).toBe("green");
    expect(orderSentence(approved)).toBe("Ordered. Purchasing manager approved.");
    expect(orderSentence(pendingOrder())).toBe("Needs the purchasing manager.");
    expect(orderLight(pendingOrder({ status: "rejected" }))).toBe("refused");
  });
});

describe("Request, Lookup, Order, Approval", () => {
  it("names the four steps in Valio Aimo's order, each with one sentence", () => {
    const steps = flowSteps(pendingOrder(), ["Compared live prices for 6 matches. 2 cannot be delivered in full on time."]);
    expect(steps.map((step) => step.name)).toEqual(["Request", "Lookup", "Order", "Approval"]);
    expect(steps[0].sentence).toBe("“1,800 l lactose-free milk”");
    expect(steps[1].sentence).toMatch(/^Compared 6 options\./);
    expect(steps[3]).toEqual({ name: "Approval", state: "current", sentence: "Waits for the purchasing manager." });
  });

  it("says who decided", () => {
    expect(flowSteps(pendingOrder({ status: "confirmed" }))[3].sentence).toBe("Your agent, inside your limits.");
    expect(flowSteps(blockedOrder())[2].state).toBe("failed");
  });

  it("explains the choice in at most three short lines", () => {
    const why = whyThisProduct(pendingOrder(), ["Compared live prices for 6 matches. 2 cannot be delivered in full on time.", "Cheapest match: Valio Eila at €1.01 per litre."]);
    expect(why[0]).toBe("The cheapest that arrives on time.");
    expect(why[1]).toBe("Compared 6 options. 2 could not arrive in full on time.");
    expect(why.length).toBeLessThanOrEqual(3);
    expect(labelWord("finnish_origin")).toBe("Finnish origin");
    expect(labelWord("eu_organic")).toBe("Organic");
  });
});
