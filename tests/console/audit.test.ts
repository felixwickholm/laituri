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
