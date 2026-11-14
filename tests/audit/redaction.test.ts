import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor, AuditEntry } from "@/lib/contracts";
import { appendAudit, contentDigest, entryHash, forgetHead, legacyEntryHash, redactEntry, verifyChain } from "@/lib/audit";
import { store } from "@/lib/store";
import { jwks, sha256Hex, TOKEN_TYPE, trust, verifyWithJwks } from "@/lib/trust";

const agent: Actor = { type: "agent", id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };
const HOTEL = "fi:ovt:003712345678";
const SCHOOL = "fi:ovt:003723456789";

async function verifyPublic(entries: Parameters<typeof verifyChain>[0]) {
  const keys = await jwks("supplier");
  return verifyChain(entries, (jws) => verifyWithJwks(jws, keys, TOKEN_TYPE.audit));
}

async function twoBuyers(): Promise<AuditEntry[]> {
  for (let i = 1; i <= 4; i++) {
    const buyerId = i % 2 ? HOTEL : SCHOOL;
    await appendAudit({ actor: agent, event: "offer.issued", summary: `Offer ${i}.`, refs: { buyerId }, data: { totals: { net: 100 * i } } });
  }
  return store().audit.list();
}

describe("audit entries sign a digest of their content", () => {
  beforeEach(async () => {
    await store().reset();
    forgetHead();
  });

  it("hashes sequence, time, event, link and a digest of the content", async () => {
    const [entry] = await twoBuyers();
    const { actor, summary, refs, data } = entry;
    expect(entry.contentDigest).toBe(await sha256Hex({ actor, summary, refs, data }));
    expect(entry.hash).toBe(await sha256Hex({ seq: entry.seq, at: entry.at, event: entry.event, prevHash: entry.prevHash, contentDigest: entry.contentDigest }));
    expect(await entryHash(entry)).toBe(entry.hash);
    expect(await contentDigest(entry)).toBe(entry.contentDigest);
  });

  it("verifies end to end when other buyers' entries are stubs", async () => {
    const entries = await twoBuyers();
    const mixed = entries.map((entry) => (entry.refs.buyerId === HOTEL ? entry : redactEntry(entry)));
    const stub = mixed[1];
    expect(stub).toEqual({
      seq: 2, at: entries[1].at, event: "offer.issued", prevHash: entries[0].hash,
      contentDigest: entries[1].contentDigest, hash: entries[1].hash, signature: entries[1].signature, redacted: true,
    });
    expect(JSON.stringify(stub)).not.toContain("Offer 2");
    expect(await verifyPublic(mixed)).toEqual({ valid: true, entries: 4, head: entries[3].hash });
  });

  it("finds a stub whose event, time or content digest was changed", async () => {
    const entries = await twoBuyers();
    const stub = redactEntry(entries[1]);
    for (const changed of [{ ...stub, event: "order.confirmed" as const }, { ...stub, at: "2026-11-14T10:00:00.000Z" }, { ...stub, contentDigest: "a".repeat(64) }]) {
      const log = [entries[0], changed, ...entries.slice(2)];
      expect(await verifyPublic(log)).toMatchObject({ valid: false, brokenAt: 2 });
    }
  });

  it("finds a full entry whose data was changed", async () => {
    const entries = await twoBuyers();
    const edited = { ...entries[2], data: { totals: { net: 9999 } } };
    expect(await verifyPublic([entries[0], entries[1], edited, entries[3]])).toMatchObject({ valid: false, brokenAt: 3, reason: expect.stringContaining("changed") });
  });

  it("still verifies a log written before content digests, and its stubs by link and signature", async () => {
    const legacy: AuditEntry[] = [];
    for (let seq = 1; seq <= 2; seq++) {
      const entry: AuditEntry = {
        seq, at: "2026-11-13T08:00:00.000Z", actor: agent, event: "catalog.searched", summary: `Old ${seq}.`,
        refs: {}, data: {}, prevHash: legacy[seq - 2]?.hash ?? "0".repeat(64), hash: "", signature: "",
      };
      entry.hash = await legacyEntryHash(entry);
      entry.signature = await trust().sign("supplier", { seq, hash: entry.hash }, TOKEN_TYPE.audit);
      legacy.push(entry);
    }
    expect(await verifyPublic(legacy)).toMatchObject({ valid: true, entries: 2 });
    expect(redactEntry(legacy[0])).toMatchObject({ redacted: true, legacy: true });
    expect(await verifyPublic([redactEntry(legacy[0]), legacy[1]])).toMatchObject({ valid: true, entries: 2 });
    expect(await verifyPublic([{ ...legacy[0], summary: "Changed." }, legacy[1]])).toMatchObject({ valid: false, brokenAt: 1 });
  });

  it("keeps writing onto a log saved before content digests, as after a redeploy, and the whole log verifies", async () => {
    let prevHash = "0".repeat(64);
    for (let seq = 1; seq <= 2; seq++) {
      const entry: AuditEntry = { seq, at: "2026-11-13T08:00:00.000Z", actor: agent, event: "catalog.searched", summary: `Old ${seq}.`, refs: {}, data: {}, prevHash, hash: "", signature: "" };
      entry.hash = await legacyEntryHash(entry);
      entry.signature = await trust().sign("supplier", { seq, hash: entry.hash }, TOKEN_TYPE.audit);
      await store().audit.append(entry);
      prevHash = entry.hash;
    }
    const next = await appendAudit({ actor: agent, event: "catalog.searched", summary: "New 3." });
    expect(next).toMatchObject({ seq: 3, prevHash, contentDigest: expect.any(String) });
    expect(await verifyPublic(await store().audit.list())).toMatchObject({ valid: true, entries: 3 });
  });
});
