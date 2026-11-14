import { describe, expect, it } from "vitest";
import { shortHash } from "@/lib/console/format/activity";
import { eur, parseEur, percentOf, withEuroSign } from "@/lib/console/format/money";
import { askedLine, matchedFacts, offeredLine, offeredShort } from "@/lib/console/format/proof";
import { askReasons, blockedLine, handledState, ruleName, shortName } from "@/lib/console/format/rules";
import { age, clock, day } from "@/lib/console/format/time";
import { weekSpend, weekStart } from "@/lib/console/format/week";
import { blockedOrder, pendingOrder } from "./fixtures";

describe("money", () => {
  it("formats euros with cents", () => {
    expect(eur(1812)).toBe("€1,812.00");
    expect(eur(0.98)).toBe("€0.98");
  });

  it("reads and rewrites the server's EUR form", () => {
    expect(parseEur("1,818.00 EUR")).toBe(1818);
    expect(parseEur("no amount")).toBeUndefined();
    expect(withEuroSign("Confirmed, 1,010.00 EUR net")).toBe("Confirmed, €1,010.00 net");
  });

  it("clamps percentages", () => {
    expect(percentOf(318, 1500)).toBe(21);
    expect(percentOf(5, 0)).toBe(0);
  });
});

describe("time", () => {
  it("uses Helsinki time and short day names", () => {
    expect(clock("2026-11-14T07:05:09.000Z")).toBe("09:05:09");
    expect(day("2026-11-16")).toBe("Mon 16 Nov");
    expect(day("2026-11-16T08:00:00.000Z")).toBe("Mon 16 Nov");
  });

  it("gives short ages", () => {
    const at = Date.parse("2026-11-14T07:00:00.000Z");
    expect(age("2026-11-14T07:00:00.000Z", at + 10_000)).toBe("now");
    expect(age("2026-11-14T07:00:00.000Z", at + 4 * 60_000)).toBe("4m");
    expect(age("2026-11-14T07:00:00.000Z", at + 3 * 3_600_000)).toBe("3h");
  });
});

describe("reasons", () => {
  it("writes the per-order reason with both figures and the overrun", () => {
    expect(askReasons(pendingOrder())).toEqual(["€318.00 over the €1,500.00 per-order limit."]);
  });

  it("writes a blocked allergen as a rule", () => {
    expect(blockedLine(blockedOrder())).toBe("Blocked. Contains nuts. The mandate forbids nuts.");
  });

  it("names rules and states in plain words", () => {
    expect(ruleName("spend.per_week")).toBe("Weekly limit");
    expect(handledState(blockedOrder())).toBe("blocked");
    expect(handledState(pendingOrder({ status: "confirmed" }))).toBe("auto");
    expect(shortName("Maria Lind, Head of Purchasing")).toBe("Maria Lind");
  });
});

describe("request versus offer", () => {
  it("shows what was asked and what was offered", () => {
    const { offer } = pendingOrder();
    expect(askedLine(offer)).toBe("Asked: 1,800 l lactose-free milk by Mon 16 Nov");
    expect(offeredLine(offer)).toBe("Offered: 1,800 × Valio Arki Eila 1 l = 1,800 l, Mon 16 Nov");
    expect(offeredShort(offer)).toBe("Offered: 1,800 × Arki Eila 1 l · Mon 16 Nov");
  });

  it("marks each matched fact", () => {
    const facts = matchedFacts(pendingOrder());
    expect(facts.map((fact) => [fact.label, fact.ok])).toEqual([
      ["Quantity", true],
      ["Claim", true],
      ["Date", true],
      ["Price", true],
    ]);
    expect(facts[3].detail).toBe("€1,818.00 net, fixed until 09:15");
  });

  it("flags a short delivery", () => {
    const order = pendingOrder();
    order.offer.lines[0].availability.available = 51;
    expect(matchedFacts(order)[0]).toMatchObject({ ok: false, detail: "51 of 1,800 available" });
  });
});

describe("hashes", () => {
  it("truncates hashes to 8 + 6", () => {
    expect(shortHash("1b090c55273ad706db8a193129023cec24b7c2d15e9a0f769b4853a29c084a58")).toBe("1b090c55…084a58");
  });
});

describe("weekly spend", () => {
  it("sums confirmed orders from Monday in Helsinki", () => {
    const now = Date.parse("2026-11-14T10:00:00.000Z");
    expect(weekStart(now)).toBe("2026-11-09");
    const orders = [pendingOrder({ status: "confirmed" }), pendingOrder({ id: "old", status: "confirmed", createdAt: "2026-11-08T10:00:00.000Z" }), pendingOrder()];
    expect(weekSpend(orders, now)).toBe(1818);
  });
});

describe("over the limit", () => {
  it("computes the difference in whole cents", async () => {
    const { overBy } = await import("@/lib/console/format/rules");
    expect(overBy(1616, 1500)).toBe(116);
    expect(overBy(0.3, 0.1)).toBe(0.2);
    expect(overBy(100, 1500)).toBe(0);
  });
});

describe("plain sentences", () => {
  it("uses the multiplication sign and keeps numbers with their units", async () => {
    const { plainSentence } = await import("@/lib/console/format/sentence");
    expect(plainSentence("Ordered 200 x Arla milk, 1 l, for 220.00 EUR net.")).toBe("Ordered 200 × Arla milk, 1\u00a0l, for €220.00\u00a0net.");
  });

  it("describes a partial offer by what was short, not by its own total", async () => {
    const { auditDetail } = await import("@/lib/console/format/audit");
    const entry = {
      event: "offer.issued" as const,
      actor: { type: "supplier" as const, id: "v", name: "Valio Aimo" },
      summary: "Valio Aimo offered 51 x Arla Milkdrink 1L for 131.07 EUR. Only 51 of 200 can be delivered. 2 alternatives were offered.",
      refs: { offerId: "off_9" },
      data: { fulfilment: "partial", alternatives: 2 },
    };
    expect(auditDetail(entry)).toBe("Only 51 of 200 in stock · 2 signed alternatives");
    expect(auditDetail({ ...entry, summary: "Valio Aimo offered 51 x Arla Milkdrink 1L." })).toBe("Partial: 51 in stock · 2 signed alternatives");
  });

  it("writes percentages without a space", async () => {
    const { plainSentence } = await import("@/lib/console/format/sentence");
    expect(plainSentence("Same product type from Valio, 57 % cheaper.")).toBe("Same product type from Valio, 57% cheaper.");
  });

  it("rewrites amounts and ISO dates", async () => {
    const { plainSentence } = await import("@/lib/console/format/sentence");
    expect(plainSentence("Delivery on 2026-11-16 meets the 2026-11-16 deadline, 1,010.00 EUR.")).toBe(
      "Delivery on Mon 16 Nov meets the Mon 16 Nov deadline, €1,010.00.",
    );
  });

  it("does not repeat the deadline when the request already names one", () => {
    const { offer } = pendingOrder();
    expect(askedLine({ ...offer, intent: "1,600 litres of milk by Monday" })).toBe("Asked: 1,600 litres of milk by Monday");
  });

});
