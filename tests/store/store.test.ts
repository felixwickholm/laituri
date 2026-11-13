import "./temp-data-dir";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "@/lib/contracts";
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
    await store().mandate.put("a.b.c");
    await store().reset();
    expect(await store().orders.list()).toEqual([]);
    expect(await store().mandate.get()).toBeUndefined();
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

  it("starts empty from a corrupt snapshot", async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "laituri-state-")), "state.json");
    writeFileSync(file, "{not json");
    expect(await createMemoryStore(file).orders.list()).toEqual([]);
  });
});
