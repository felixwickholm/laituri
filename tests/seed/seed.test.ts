import "../store/temp-data-dir";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_DEMO_STEP_MS = "0";

const { verifyAuditLog } = await import("@/lib/audit");
const { withClock } = await import("@/lib/clock");
const { TOKEN_TYPE, trust } = await import("@/lib/trust");
const { getRun, resetDemo, startRun } = await import("@/lib/demo");
const { gateway } = await import("@/lib/gateway");
const { BUYER_IDS } = await import("@/lib/mandate");
const { SEED_REQUESTS, seedIfEmpty } = await import("@/lib/seed");
const { store } = await import("@/lib/store");

const recorded = existsSync(path.join(process.cwd(), "fixtures", "upstream", "price.json"));
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

async function fresh(): Promise<void> {
  await gateway().reset();
  resetDemo();
}

/** Plays the three console scenes and returns how each purchase ended and what the break-mandate run says. */
async function playScenes(): Promise<{ statuses: string[]; brokenRules: string | undefined }> {
  const statuses: string[] = [];
  for (const scenario of ["milk", "over-limit"] as const) {
    const { runId, done } = startRun({ scenario });
    await done;
    statuses.push(...(getRun(runId)?.results ?? []).map((result) => result.status));
  }
  const { runId, done } = startRun({ scenario: "break-mandate" });
  await done;
  return { statuses, brokenRules: getRun(runId)?.summary };
}

beforeEach(async () => {
  process.env.LAITURI_SEED = "on";
  await fresh();
});

afterEach(() => {
  process.env.LAITURI_SEED = "off";
});

/** Each test seeds a signed week of trade through the real gateway; with every file running at once that takes a while. */
describe.skipIf(!recorded)("seeded demo history", { timeout: 60_000 }, () => {
  it("writes four weeks of standing orders and a week of trade that verify end to end", async () => {
    const status = await seedIfEmpty();
    const basketLines = (await store().baskets.list()).flatMap((basket) => basket.lines).length;
    expect(basketLines).toBeGreaterThan(40);
    expect(status).toMatchObject({ state: "seeded", requests: SEED_REQUESTS.length + basketLines });
    expect((await verifyAuditLog()).valid).toBe(true);

    const requests = await store().requests.list();
    const pinned = Date.parse(process.env.LAITURI_NOW!);
    expect(new Set(requests.map((r) => r.requestId)).size).toBe(SEED_REQUESTS.length + basketLines);
    expect(requests.every((r) => Date.parse(r.at) <= pinned && pinned - Date.parse(r.at) < 5 * WEEK_MS)).toBe(true);
    const thisWeek = requests.filter((r) => pinned - Date.parse(r.at) < WEEK_MS);
    expect(thisWeek.length).toBeGreaterThanOrEqual(SEED_REQUESTS.length);
    expect(new Set(requests.map((r) => r.buyer?.id)).size).toBe(3);
    expect(new Set(requests.map((r) => r.client)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(requests.map((r) => r.at.slice(0, 10))).size).toBeGreaterThanOrEqual(5);
  });

  it("covers every outcome the demo talks about", async () => {
    await seedIfEmpty();
    const orders = await store().orders.list();
    const outcomes = new Set((await store().requests.list()).map((r) => r.outcome));
    expect([...outcomes]).toEqual(expect.arrayContaining(["met_in_full", "met_with_alternative", "cutoff_passed", "not_found"]));

    const blockedBy = orders.filter((o) => o.status === "blocked").flatMap((o) => o.decision.checks.filter((c) => c.status === "block").map((c) => c.rule));
    expect(blockedBy).toEqual(expect.arrayContaining(["dietary.allergens", "substitution.policy"]));
    expect(orders.some((o) => o.status === "confirmed" && !o.approval)).toBe(true);
    expect(orders.filter((o) => o.status === "confirmed" && o.approval?.decision === "approved").length).toBeGreaterThanOrEqual(3);
    expect(orders.filter((o) => o.status === "rejected" && o.approval?.decision === "rejected")).toHaveLength(1);

    const waiting = orders.filter((o) => o.status === "pending_approval");
    expect(waiting.map((o) => o.buyer.id)).toEqual([BUYER_IDS.kaisla]);
    expect(await gateway().pendingApprovals()).toEqual([]);
  });

  it("keeps the waiting order decidable while the demo runs, with the longer hold in the signed offer", async () => {
    await seedIfEmpty();
    const [waiting] = (await store().orders.list()).filter((o) => o.status === "pending_approval");
    const { offer } = waiting;
    expect(Date.parse(offer.expiresAt) - Date.parse(offer.issuedAt)).toBeGreaterThan(5 * DAY_MS);
    expect(Date.parse(offer.expiresAt)).toBe(Date.parse(offer.orderBy!));
    const signed = await store().offers.get(offer.id);
    expect((await trust().verify<{ expiresAt: string }>("supplier", signed!.jws, TOKEN_TYPE.offer)).payload?.expiresAt).toBe(offer.expiresAt);

    const others = (await store().offers.list()).filter((o) => o.offer.id !== offer.id);
    expect(others.every(({ offer: o }) => Date.parse(o.expiresAt) - Date.parse(o.issuedAt) <= 15 * 60_000)).toBe(true);

    const twoDaysLater = new Date(Date.parse(process.env.LAITURI_NOW!) + 2 * DAY_MS);
    const decided = await withClock(() => twoDaysLater, () =>
      gateway().decideApproval(waiting.id, { decision: "approved" }, { buyerId: BUYER_IDS.kaisla }),
    );
    expect(decided.status).toBe("confirmed");
  });

  it("marks everything it wrote as seeded", async () => {
    await seedIfEmpty();
    expect((await store().orders.list()).every((o) => o.seeded)).toBe(true);
    expect((await store().audit.list()).every((e) => e.seeded)).toBe(true);
    expect((await store().activity.list()).every((a) => a.seeded)).toBe(true);
    expect((await store().requests.list()).every((r) => r.seeded)).toBe(true);
    expect((await gateway().supplierOverview()).includesSeeded).toBe(true);
  });

  it("seeds only an empty state, and not at all when turned off", async () => {
    await seedIfEmpty();
    const size = (await store().audit.list()).length;
    expect(await seedIfEmpty()).toMatchObject({ state: "skipped" });
    expect(await store().audit.list()).toHaveLength(size);

    await fresh();
    process.env.LAITURI_SEED = "off";
    expect(await seedIfEmpty()).toEqual({ state: "off" });
    expect(await store().audit.list()).toEqual([]);
  });

  it("leaves the console's three scenes behaving as on an empty week", async () => {
    const empty = await playScenes();
    await fresh();
    await seedIfEmpty();
    const seeded = await playScenes();
    expect(seeded).toEqual(empty);
    expect(seeded.statuses).toEqual(["confirmed", "waiting", "confirmed"]);
    expect(seeded.brokenRules).toBe("5 of 5 attempts to break the mandate were stopped.");
  });
});
