import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/contracts";
import { entriesPerDay, eventGroup } from "@/lib/console/format/log";
import { buyerOrders, isSeeded, orderOutcome, weekStats } from "@/lib/console/format/orders";
import { duration } from "@/lib/console/format/time";
import { todayVerdict } from "@/lib/console/format/verdict";
import { blockedOrder, pendingOrder } from "./fixtures";

const NOW = Date.parse("2026-11-14T10:00:00.000Z");

function confirmed(id: string, net: number, approvedBy?: string): Order {
  const order = pendingOrder({ id, status: "confirmed" });
  order.offer = { ...order.offer, totals: { ...order.offer.totals, net: { amount: net, currency: "EUR" } } };
  if (approvedBy) {
    order.approval = { decidedBy: { id: "u", name: approvedBy }, decision: "approved", decidedAt: order.createdAt, jws: "a.b.c" };
  }
  return order;
}

describe("order outcomes", () => {
  it("names how each order ended", () => {
    expect(orderOutcome(confirmed("a", 10)).label).toBe("Confirmed automatically");
    expect(orderOutcome(confirmed("b", 10, "Maria Lind, Head of Purchasing")).label).toBe("Approved by Maria Lind");
    expect(orderOutcome(pendingOrder()).key).toBe("waiting");
    const blocked = orderOutcome(blockedOrder());
    expect(blocked.key).toBe("blocked");
    expect(blocked.rule).toBe("Never-buy allergens");
  });

  it("keeps only the mandate's buyer", () => {
    const other = pendingOrder({ id: "x", buyer: { id: "other", name: "Other" } });
    const mandate = { jws: "", mandate: { buyer: { id: "fi:ovt:003712345678" } } } as never;
    expect(buyerOrders([pendingOrder(), other], mandate).map((order) => order.id)).toEqual(["ord_1"]);
  });

  it("reads the seeded mark only when it is set", () => {
    expect(isSeeded({ ...pendingOrder(), seeded: true })).toBe(true);
    expect(isSeeded(pendingOrder())).toBe(false);
  });
});

describe("the week", () => {
  it("sums confirmed spend in cents and counts the queue", () => {
    const week = weekStats([confirmed("a", 0.1), confirmed("b", 0.2, "Maria Lind"), pendingOrder(), blockedOrder()], NOW);
    expect(week.spent).toBe(0.3);
    expect(week.confirmed).toBe(2);
    expect(week.confirmedAuto).toBe(1);
    expect(week.confirmedApproved).toBe(1);
    expect(week.waiting).toBe(1);
    expect(week.waitingAmount).toBe(1818);
    expect(week.blocked).toBe(1);
  });

  it("puts the decision first in the verdict", () => {
    const week = weekStats([confirmed("a", 10), pendingOrder()], NOW);
    expect(todayVerdict(week, false, true)).toMatchObject({ lead: "1 order needs you.", reason: "Everything else ran inside your mandate." });
    expect(todayVerdict(week, true, true).lead).toBe("The log does not verify.");
    expect(todayVerdict(weekStats([], NOW), false, false).lead).toBe("Nothing needs you yet.");
  });
});

describe("the log", () => {
  it("counts entries per Helsinki day for the last seven days", () => {
    const days = entriesPerDay([{ at: "2026-11-14T08:00:00Z" }, { at: "2026-11-13T22:30:00Z" }, { at: "2026-11-01T08:00:00Z" }], NOW);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ date: "2026-11-14", label: "Sat", today: true, count: 2 });
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(2);
  });

  it("groups events for the filter", () => {
    expect(eventGroup("approval.granted")).toBe("approvals");
    expect(eventGroup("access.refused")).toBe("refused");
  });
});

describe("duration", () => {
  it("says how long a run took", () => {
    expect(duration(400)).toBe("under 1 s");
    expect(duration(6_200)).toBe("6 s");
    expect(duration(64_000)).toBe("1 min 4 s");
  });
});
