import { describe, expect, it } from "vitest";
import type { Basket, Handoff } from "@/lib/contracts";
import { handoffContext, handoffsHeadline, sortHandoffs, toldKitchen } from "@/lib/supplier-console/handoffs";

function handoff(id: string, at: string, status: Handoff["status"], extra: Partial<Handoff> = {}): Handoff {
  return {
    id,
    at,
    buyer: { id: "buyer:harbour", name: "Nordic Harbour Hotels" },
    from: "Purchasing manager",
    words: "Can we take oat cream instead?",
    context: { summary: "Cooking cream, 40 l, needs a substitute." },
    status,
    openHours: { open: true, sentence: "Valio Aimo answers now." },
    ...extra,
  };
}

const BASKET = {
  id: "bsk_1",
  title: "Weekly order",
  lines: [
    {
      id: "line_7",
      words: "cooking cream",
      asked: { amount: 40, unit: "l" },
      state: "orange",
      reasonCode: "substitute_needs_ok",
      reason: "The substitute is not lactose-free. Check it once.",
      product: { id: "p1", name: "Oat cooking base 1 l" },
      net: 96.4,
    },
  ],
  totals: { lines: 20 },
} as unknown as Basket;

describe("hand-offs", () => {
  it("puts open questions first, newest first", () => {
    const list = [handoff("a", "2026-11-14T08:00:00Z", "answered"), handoff("b", "2026-11-14T07:00:00Z", "open"), handoff("c", "2026-11-14T09:00:00Z", "open")];
    expect(sortHandoffs(list).map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("says how many wait, in plain words", () => {
    expect(handoffsHeadline([])).toBe("No customer has asked for a person yet.");
    expect(handoffsHeadline([handoff("a", "2026-11-14T08:00:00Z", "open")])).toBe("1 question waits for an answer.");
    expect(handoffsHeadline([handoff("a", "2026-11-14T08:00:00Z", "answered")])).toBe("Every question has an answer.");
  });

  it("attaches the line, why it stopped and the amount", () => {
    const item = handoff("a", "2026-11-14T08:00:00Z", "open", { context: { basketId: "bsk_1", lineId: "line_7", summary: "Cooking cream needs an OK." } });
    const rows = handoffContext(item, [BASKET]);
    expect(rows.map((row) => row.label)).toEqual(["About", "Order", "Line", "Why it stopped", "Product", "Amount"]);
    expect(rows.find((row) => row.label === "Line")?.value).toBe("cooking cream · 40 l");
  });

  it("keeps the summary alone when the basket is not known", () => {
    expect(handoffContext(handoff("a", "2026-11-14T08:00:00Z", "open"), [])).toEqual([{ label: "About", value: "Cooking cream, 40 l, needs a substitute." }]);
  });

  it("shows what the kitchen was told only out of hours", () => {
    expect(toldKitchen(handoff("a", "2026-11-14T08:00:00Z", "open"))).toBeUndefined();
    const late = handoff("a", "2026-11-14T22:00:00Z", "open", { openHours: { open: false, sentence: "Valio Aimo answers on Monday from 8:00." } });
    expect(toldKitchen(late)).toBe("Valio Aimo answers on Monday from 8:00.");
  });
});
