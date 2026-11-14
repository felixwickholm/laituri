import { describe, expect, it } from "vitest";
import { AuditEvent } from "@/lib/contracts";
import { auditTitle } from "@/lib/console/format/audit";

const agent = { type: "agent" as const, id: "a", name: "Harbour purchasing agent" };
const maria = { type: "human" as const, id: "u", name: "Maria Lind, Head of Purchasing" };

describe("auditTitle", () => {
  it("has a plain title for every event in the contract", () => {
    for (const event of AuditEvent.options) {
      const title = auditTitle({ event, actor: agent });
      expect(title).not.toContain(".");
      expect(title.length).toBeGreaterThan(3);
    }
  });

  it("names the person on a human decision", () => {
    expect(auditTitle({ event: "approval.granted", actor: maria })).toBe("Approved by Maria Lind");
    expect(auditTitle({ event: "approval.rejected", actor: maria })).toBe("Rejected by Maria Lind");
    expect(auditTitle({ event: "approval.rejected", actor: agent })).toBe("Approval refused");
    expect(auditTitle({ event: "policy.evaluated", actor: agent })).toBe("Checked against the mandate");
  });
});

describe("auditDetail", () => {
  const base = { actor: agent, summary: "Fallback sentence.", refs: {} };

  it("writes short lines from structured data", async () => {
    const { auditDetail } = await import("@/lib/console/format/audit");
    const { pendingOrder } = await import("./fixtures");
    const order = pendingOrder();
    expect(auditDetail({ ...base, event: "catalog.searched", data: { query: "lactose-free milk", previews: 10 } })).toBe("Found 10 products for 'lactose-free milk'");
    expect(auditDetail({ ...base, event: "policy.evaluated", data: { outcome: "auto_approved", checks: [] } })).toBe("All 15 checks passed");
    expect(auditDetail({ ...base, event: "policy.evaluated", data: { outcome: "needs_approval", checks: [{ status: "ask" }] } })).toBe("1 of 15 checks needs a person");
    expect(auditDetail({ ...base, event: "order.confirmed", refs: { orderId: "ord_1" }, data: {} }, [order])).toBe("1,800 × Arki Eila 1 l · €1,818.00 net");
    expect(auditDetail({ ...base, event: "approval.requested", refs: { orderId: "ord_1" }, data: {} }, [order])).toBe("€318.00 over the €1,500.00 per-order limit.");
  });

  it("falls back to the entry's own sentence", async () => {
    const { auditDetail } = await import("@/lib/console/format/audit");
    expect(auditDetail({ ...base, event: "order.confirmed", data: {} })).toBe("Fallback sentence.");
  });
});

describe("refused attempts", () => {
  it("are titled plainly and explained from their own summary", async () => {
    const { auditDetail } = await import("@/lib/console/format/audit");
    const entry = { event: "access.refused" as const, actor: agent, summary: "An agent tried to reset the demo without the approver session.", refs: {}, data: {} };
    expect(auditTitle(entry)).toBe("Attempt refused");
    expect(auditDetail(entry)).toBe(entry.summary);
  });
});
