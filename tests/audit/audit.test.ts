import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/contracts";
import { appendAudit, checkpoint, forgetHead, GENESIS_HASH, verifyAuditLog, verifyChain } from "@/lib/audit";
import { store } from "@/lib/store";
import { jwks, trust, verifyWithJwks } from "@/lib/trust";

const agent: Actor = { type: "agent", id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };

async function appendFive() {
  for (let i = 1; i <= 5; i++) {
    await appendAudit({ actor: agent, event: "catalog.searched", summary: `Search ${i}.`, data: { query: `milk ${i}`, skip: undefined } });
  }
  return store().audit.list();
}

describe("audit chain", () => {
  beforeEach(async () => {
    await store().reset();
    forgetHead();
  });

  it("appends linked, signed entries that verify", async () => {
    const entries = await appendFive();
    expect(entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    const result = await verifyAuditLog();
    expect(result).toEqual({ valid: true, entries: 5, head: entries[4].hash });
  });

  it("verifies with the public JWKS only", async () => {
    const entries = await appendFive();
    const keys = await jwks("supplier");
    const result = await verifyChain(entries, (jws) => verifyWithJwks(jws, keys));
    expect(result.valid).toBe(true);
  });

  it("finds an edited summary", async () => {
    const entries = await appendFive();
    await store().audit.replace(3, { ...entries[2], summary: "Something else." });
    expect(await verifyAuditLog()).toMatchObject({ valid: false, brokenAt: 3 });
  });

  it("finds a deleted middle entry", async () => {
    const entries = await appendFive();
    const withoutThird = entries.filter((e) => e.seq !== 3);
    const result = await verifyChain(withoutThird, (jws) => trust().verify("supplier", jws));
    expect(result).toMatchObject({ valid: false, brokenAt: 4 });
  });

  it("finds a swapped signature", async () => {
    const entries = await appendFive();
    await store().audit.replace(4, { ...entries[3], signature: entries[1].signature });
    const result = await verifyAuditLog();
    expect(result).toMatchObject({ valid: false, brokenAt: 4 });
    expect(result.reason).toContain("different entry");
  });

  it("keeps one chain under concurrent appends", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => appendAudit({ actor: agent, event: "offer.issued", summary: `Offer ${i}.` })),
    );
    const entries = await store().audit.list();
    expect(entries).toHaveLength(20);
    expect(new Set(entries.map((e) => e.seq)).size).toBe(20);
    expect((await verifyAuditLog()).valid).toBe(true);
  });

  it("signs a checkpoint of size and head", async () => {
    const entries = await appendFive();
    const { checkpoint: value, jws } = await checkpoint();
    expect(value).toMatchObject({ size: 5, head: entries[4].hash });
    expect((await trust().verify("supplier", jws)).payload).toEqual(value);
  });

  it("finds a log whose newest entries were removed", async () => {
    const entries = await appendFive();
    const verifier = (jws: string) => trust().verify("supplier", jws);
    const recorded = { size: 5, head: entries[4].hash };
    expect(await verifyChain(entries, verifier, recorded)).toMatchObject({ valid: true, entries: 5 });
    expect(await verifyChain(entries.slice(0, 3), verifier, recorded)).toMatchObject({ valid: false, brokenAt: 4 });
    expect(await verifyChain([], verifier, recorded)).toMatchObject({ valid: false, brokenAt: 1 });
  });

  it("finds a stored log that was wiped behind the service", async () => {
    await appendFive();
    await store().reset();
    expect(await verifyAuditLog()).toMatchObject({ valid: false, entries: 0, brokenAt: 1 });
    forgetHead();
    expect(await verifyAuditLog()).toMatchObject({ valid: true, entries: 0 });
  });
});
