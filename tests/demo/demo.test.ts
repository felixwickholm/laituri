import "../store/temp-data-dir";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_DEMO_STEP_MS = "0";

const { appendAudit, verifyAuditLog } = await import("@/lib/audit");
const { gateway } = await import("@/lib/gateway");
const { getRun, resetDemo, restoreAudit, startRun, tamperAudit, RunActiveError } = await import("@/lib/demo");
const { store } = await import("@/lib/store");

const actor = { type: "agent" as const, id: "agent:test", name: "Test agent" };
const recorded = existsSync(path.join(process.cwd(), "fixtures", "upstream", "price.json"));

beforeEach(async () => {
  await gateway().reset();
  resetDemo();
});

describe("tamperAudit", () => {
  it("breaks verification at the edited entry and restores it", async () => {
    await appendAudit({ actor, event: "catalog.searched", summary: "Searched." });
    await appendAudit({ actor, event: "order.requested", summary: "Asked.", data: { totals: { net: { amount: 10 }, gross: { amount: 12 } } } });
    await appendAudit({ actor, event: "policy.evaluated", summary: "Checked." });
    expect((await verifyAuditLog()).valid).toBe(true);

    const { seq } = await tamperAudit();
    expect(seq).toBe(2);
    const broken = await verifyAuditLog();
    expect(broken.valid).toBe(false);
    expect(broken.brokenAt).toBe(2);

    expect(await restoreAudit()).toBe(true);
    expect((await verifyAuditLog()).valid).toBe(true);
  });

  it("leaves the newest entry alone, so the service keeps writing while the edit is shown", async () => {
    await appendAudit({ actor, event: "order.requested", summary: "Asked.", data: { totals: { net: { amount: 10 }, gross: { amount: 12 } } } });
    await appendAudit({ actor, event: "order.confirmed", summary: "Confirmed.", data: { totals: { net: { amount: 10 }, gross: { amount: 12 } } } });
    const { seq } = await tamperAudit();
    expect(seq).toBe(1);
    await expect(appendAudit({ actor, event: "catalog.searched", summary: "Searched." })).resolves.toMatchObject({ seq: 3 });
    expect(await restoreAudit()).toBe(true);
  });

  it("refuses an empty log", async () => {
    await expect(tamperAudit()).rejects.toThrow("The audit log is empty");
  });
});

describe.skipIf(!recorded)("demo scenes on recorded data", () => {
  it("milk: confirmed and auto-approved", async () => {
    const { runId, done } = startRun({ scenario: "milk" });
    expect(() => startRun({ scenario: "milk" })).toThrow(RunActiveError);
    await done;
    const run = getRun(runId);
    expect(run?.status).toBe("done");
    expect(run?.results?.[0].status).toBe("confirmed");
    const notes = (await store().activity.list()).filter((a) => a.kind === "note").map((a) => a.title);
    expect(notes).toContain("Inside my mandate. Order placed.");
    expect((await verifyAuditLog()).valid).toBe(true);
  });

  it("pauses approvals while the log is broken", async () => {
    await startRun({ scenario: "over-limit" }).done;
    const [waiting] = await gateway().pendingApprovals();
    await tamperAudit();
    await expect(gateway().decideApproval(waiting.id, { decision: "approved" })).rejects.toMatchObject({ code: "audit_broken", status: 409 });
    await restoreAudit();
    expect((await gateway().decideApproval(waiting.id, { decision: "approved" })).status).toBe("confirmed");
  });

  it("over-limit: leaves one or two orders for the approver", async () => {
    const { done } = startRun({ scenario: "over-limit" });
    await done;
    const pending = await gateway().pendingApprovals();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.length).toBeLessThanOrEqual(2);
    const activity = (await store().activity.list()).filter((a) => !a.title.endsWith(" connected"));
    expect(activity.every((a) => a.run)).toBe(true);
    expect(activity.some((a) => a.kind === "tool")).toBe(true);
    const titles = [...new Set(activity.map((a) => a.run?.title))];
    expect(titles).toEqual(["1,600 litres of lactose-free milk by Monday", "200 litres of lactose-free skimmed milk by Monday"]);
    const second = activity.filter((a) => a.kind === "note" && a.run?.title === titles[1]).map((a) => a.title);
    expect(second.join("\n")).not.toContain("product 462775");
  });

  it("break-mandate: all four attempts are stopped and nothing is confirmed", async () => {
    const { runId, done } = startRun({ scenario: "break-mandate" });
    await done;
    expect(getRun(runId)?.summary).toBe("5 of 5 attempts to break the mandate were stopped.");
    const orders = await gateway().listOrders();
    expect(orders.filter((o) => o.status === "confirmed")).toHaveLength(0);
    expect(orders.filter((o) => o.status === "blocked")).toHaveLength(3);
    const audit = await store().audit.list();
    expect(audit.some((e) => e.event === "approval.rejected" && e.data.refused === true)).toBe(true);
  });

  it("free text runs the same agent", async () => {
    const { runId, done } = startRun({ request: "milk for Monday" });
    await done;
    expect(getRun(runId)?.results?.[0].status).toBe("needs_input");
  });
});
