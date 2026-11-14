import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import { appendAudit, verifyAuditLog } from "@/lib/audit";
import { now, withClock } from "@/lib/clock";
import { asSeeded } from "@/lib/provenance";
import { store } from "@/lib/store";

const actor = { type: "supplier" as const, id: "valio-aimo", name: "Valio Aimo" };

beforeEach(() => store().reset());

describe("seeded history in the audit log", () => {
  it("marks entries written as demo history, at their own past time, and covers the mark by the hash", async () => {
    const past = new Date("2026-11-09T06:00:00.000Z");
    await asSeeded(() => withClock(() => past, () => appendAudit({ actor, event: "catalog.searched", summary: "Seeded." })));
    const live = await appendAudit({ actor, event: "catalog.searched", summary: "Live." });
    const [seeded] = await store().audit.list();
    expect(seeded).toMatchObject({ seeded: true, at: past.toISOString() });
    expect(live.seeded).toBeUndefined();
    expect((await verifyAuditLog()).valid).toBe(true);

    const unmarked = { ...seeded };
    delete unmarked.seeded;
    await store().audit.replace(seeded.seq, unmarked);
    expect(await verifyAuditLog()).toMatchObject({ valid: false, brokenAt: 1 });
  });

  it("leaves the clock alone outside withClock", async () => {
    const inside = await withClock(() => new Date("2020-01-01T00:00:00.000Z"), async () => now().toISOString());
    expect(inside).toBe("2020-01-01T00:00:00.000Z");
    expect(now().toISOString()).toBe(new Date(process.env.LAITURI_NOW!).toISOString());
  });
});
