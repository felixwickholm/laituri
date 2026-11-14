import "../store/temp-data-dir";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.VALIO_MODE = "recorded";
process.env.LAITURI_DEMO_STEP_MS = "0";

const { verifyAuditLog } = await import("@/lib/audit");
const { getRun, resetDemo, startRun, TWO_KITCHENS_REQUEST } = await import("@/lib/demo");
const { gateway } = await import("@/lib/gateway");
const { BUYER_IDS } = await import("@/lib/mandate");
const { seedIfEmpty } = await import("@/lib/seed");
const { store } = await import("@/lib/store");

const recorded = existsSync(path.join(process.cwd(), "fixtures", "upstream", "price.json"));
const CIABATTA = "471464";

beforeEach(async () => {
  await gateway().reset();
  resetDemo();
});

afterEach(() => {
  process.env.LAITURI_SEED = "off";
});

/** Plays the scene and checks that only the mandates made the difference. */
async function playTwoKitchens(): Promise<void> {
  const { runId, done } = startRun({ scenario: "two-kitchens" });
  await done;
  const run = getRun(runId);
  expect(run?.status).toBe("done");
  expect(run?.results?.map((result) => result.status)).toEqual(["confirmed", "blocked"]);

  const live = (await store().orders.list()).filter((order) => !order.seeded);
  const [hotel, school] = live;
  expect(live).toHaveLength(2);
  expect(hotel).toMatchObject({ status: "confirmed", buyer: { id: BUYER_IDS.nordicHarbour }, agent: { id: "agent:harbour-purchasing" } });
  expect(school).toMatchObject({ status: "blocked", buyer: { id: BUYER_IDS.kaisla }, agent: { id: "agent:kaisla-menu-planner" } });
  for (const order of live) expect(order.offer.lines.map((line) => line.productId)).toEqual([CIABATTA]);
  expect(school.offer.totals).toEqual(hotel.offer.totals);
  expect(school.offer.intent).toBe(hotel.offer.intent);

  const blocks = school.decision.checks.filter((check) => check.status === "block");
  expect(blocks.map((check) => [check.rule, check.message])).toEqual([["dietary.allergens", "Dafgårds ciabatta 58g may contain sesame."]]);
  expect(hotel.decision.checks.find((check) => check.rule === "dietary.allergens")?.status).toBe("pass");

  const tagged = (await store().activity.list()).filter((item) => !item.seeded && item.run);
  const runs = new Map<string, Set<string>>();
  for (const item of tagged) runs.set(item.run!.id, (runs.get(item.run!.id) ?? new Set()).add(`${item.agent.id}|${item.buyer?.id}`));
  expect([...runs.values()].map((callers) => [...callers])).toEqual([
    [`agent:harbour-purchasing|${BUYER_IDS.nordicHarbour}`],
    [`agent:kaisla-menu-planner|${BUYER_IDS.kaisla}`],
  ]);
  expect(new Set(tagged.map((item) => item.run!.title))).toEqual(new Set([TWO_KITCHENS_REQUEST]));
  expect((await verifyAuditLog()).valid).toBe(true);
}

describe.skipIf(!recorded)("scene: same sentence, two kitchens", () => {
  it("confirms for the hotel and blocks for the school kitchens on an empty state", async () => {
    process.env.LAITURI_SEED = "off";
    await playTwoKitchens();
  });

  it("ends the same way after the demo history is seeded", async () => {
    process.env.LAITURI_SEED = "on";
    expect(await seedIfEmpty()).toMatchObject({ state: "seeded" });
    await playTwoKitchens();
  });
});
