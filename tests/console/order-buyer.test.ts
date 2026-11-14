import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/lib/contracts";
import { buyerOfOrder } from "@/lib/console/order-buyer";

function entry(seq: number, refs: AuditEntry["refs"]): AuditEntry {
  return { seq, refs } as unknown as AuditEntry;
}

describe("buyerOfOrder", () => {
  const audit = [entry(1, { offerId: "off_1", buyerId: "kaisla" }), entry(2, { orderId: "ord_1" }), entry(3, { orderId: "ord_1", buyerId: "kaisla" }), entry(4, { orderId: "ord_2", buyerId: "laine" })];

  it("names the buyer from the first entry that carries both the order and a buyer", () => {
    expect(buyerOfOrder(audit, "ord_1")).toBe("kaisla");
    expect(buyerOfOrder(audit, "ord_2")).toBe("laine");
  });

  it("knows no buyer for an order the log never named", () => {
    expect(buyerOfOrder(audit, "ord_9")).toBeUndefined();
    expect(buyerOfOrder([], "ord_1")).toBeUndefined();
  });
});
