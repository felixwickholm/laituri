import "./temp-data-dir";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuditEntry, Order } from "@/lib/contracts";
import { store, type StoredOrder } from "@/lib/store";
import { createMemoryStore } from "@/lib/store/memory";
import { jwks } from "@/lib/trust";
import { testDataDir } from "./temp-data-dir";

function order(id: string, idempotencyKey?: string): StoredOrder {
  return {
    id,
    idempotencyKey,
    status: "confirmed",
    createdAt: "2026-11-14T07:00:00.000Z",
    updatedAt: "2026-11-14T07:00:00.000Z",
    mandateId: "m",
    agent: { id: "a", name: "A" },
    buyer: { id: "b", name: "B" },
    offer: {} as Order["offer"],
    decision: { outcome: "auto_approved", checks: [] },
    simulated: true,
  };
}

describe("store", () => {
  beforeEach(() => store().reset());

  it("finds an order by idempotency key", async () => {
    await store().orders.put(order("ord-1", "key-12345678"));
    await store().orders.put(order("ord-2"));
    expect((await store().orders.byIdempotencyKey("key-12345678"))?.id).toBe("ord-1");
    expect(await store().orders.byIdempotencyKey("missing-key")).toBeUndefined();
  });

  it("lists activity after an id", async () => {
    const base = { at: "2026-11-14T07:00:00Z", agent: { id: "a", name: "A" }, kind: "tool" as const, status: "ok" as const };
    for (const id of ["x1", "x2", "x3"]) await store().activity.append({ ...base, id, title: id });
    expect((await store().activity.list("x1")).map((a) => a.id)).toEqual(["x2", "x3"]);
  });

  it("resets everything except keys", async () => {
    const before = await jwks("supplier");
    await store().orders.put(order("ord-1", "key-12345678"));
    await store().mandates.put("buyer:a", "a.b.c");
    await store().reset();
    expect(await store().orders.list()).toEqual([]);
    expect(await store().mandates.get("buyer:a")).toBeUndefined();
    expect((await jwks("supplier")).keys[0].kid).toBe(before.keys[0].kid);
    expect(existsSync(path.join(testDataDir!, "keys", "supplier.json"))).toBe(true);
  });

  it("saves a snapshot and loads it on start", async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "laituri-state-")), "state.json");
    const first = createMemoryStore(file);
    await first.orders.put(order("ord-9", "key-abcdefgh"));
    first.flush();
    expect(JSON.parse(readFileSync(file, "utf8")).orders["ord-9"].id).toBe("ord-9");
    const second = createMemoryStore(file);
    expect((await second.orders.byIdempotencyKey("key-abcdefgh"))?.id).toBe("ord-9");
  });

  it("starts empty from a corrupt snapshot, keeps the file aside and reports it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "laituri-state-"));
    const file = path.join(dir, "state.json");
    writeFileSync(file, "{not json");
    const recovered = createMemoryStore(file);
    expect(await recovered.orders.list()).toEqual([]);
    const kept = readdirSync(dir).find((name) => name.startsWith("state.json.unreadable-"));
    expect(kept).toBeDefined();
    expect(readFileSync(path.join(dir, kept!), "utf8")).toBe("{not json");
    expect(recovered.recovery()).toMatchObject({ keptAs: path.join(dir, kept!) });
    expect(recovered.recovery()?.reason).toMatch(/JSON/);
    expect(createMemoryStore(path.join(dir, "fresh.json")).recovery()).toBeUndefined();
  });
});

const entry = { seq: 1, at: "2026-11-14T07:00:00.000Z", actor: { type: "agent", id: "a", name: "A" }, event: "catalog.searched",
  summary: "Searched.", refs: {}, data: {}, prevHash: "0", hash: "h", signature: "s" } as AuditEntry;

describe("durable writes", () => {
  it("has an audit entry, an order and a mandate on disk when the call returns", async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "laituri-state-")), "state.json");
    const durable = createMemoryStore(file);
    await durable.audit.append(entry);
    expect(JSON.parse(readFileSync(file, "utf8")).audit).toHaveLength(1);
    await durable.orders.put(order("ord-1", "key-12345678"));
    expect(JSON.parse(readFileSync(file, "utf8")).orders["ord-1"].id).toBe("ord-1");
    await durable.mandates.put("buyer:a", "a.b.c");
    expect(JSON.parse(readFileSync(file, "utf8")).mandates["buyer:a"]).toBe("a.b.c");
  });

  it("fails the call and keeps memory unchanged when the write fails", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "laituri-state-"));
    const file = path.join(dir, "state.json");
    const durable = createMemoryStore(file);
    await durable.orders.put(order("ord-1", "key-12345678"));
    chmodSync(dir, 0o500);
    try {
      await expect(durable.audit.append(entry)).rejects.toThrow(/could not be saved/);
      await expect(durable.orders.put({ ...order("ord-1", "key-12345678"), status: "blocked" })).rejects.toThrow(/could not be saved/);
      await expect(durable.mandates.put("buyer:a", "a.b.c")).rejects.toThrow(/could not be saved/);
    } finally {
      chmodSync(dir, 0o700);
    }
    expect(await durable.audit.list()).toEqual([]);
    expect((await durable.orders.get("ord-1"))?.status).toBe("confirmed");
    expect(await durable.mandates.get("buyer:a")).toBeUndefined();
  });
});
