import { fixtureCatalog } from "@/lib/catalog";
import { now, withClock } from "@/lib/clock";
import { createGateway } from "@/lib/gateway/gateway";
import { inRun } from "@/lib/gateway/recorder";
import { realDeps } from "@/lib/gateway/deps";
import type { Deps } from "@/lib/gateway/types";
import { PRIMARY_BUYER_ID, buyerIds, currentMandate, updateMandate } from "@/lib/mandate";
import { asSeeded } from "@/lib/provenance";
import { store } from "@/lib/store";
import { createVolatileStore } from "@/lib/store/memory";
import { RecordedUpstream } from "@/lib/valio/recorded";
import { currentWorkspace, inWorkspace, inheritedSlots, newWorkspace } from "@/lib/workspace/context";
import { playWeeklyOrders } from "./baskets";
import { SEED_REQUESTS } from "./plan";
import { playRequest, startOf, type OfferHold, type PlayContext, type SeedClock } from "./play";
import { SeedUpstream } from "./upstream";

export { SEED_REQUESTS, type SeedRequest } from "./plan";

/** What the last seeding attempt did, for the health check. */
export type SeedStatus =
  | { state: "seeded"; at: string; requests: number; orders: number }
  | { state: "skipped"; reason: string }
  | { state: "failed"; reason: string }
  | { state: "off" };

const holder = globalThis as typeof globalThis & { __laituriSeedStatus?: SeedStatus };

/** LAITURI_SEED=off keeps a fresh start empty. Seeding is on by default; tests and evals turn it off. */
export function seedEnabled(): boolean {
  return process.env.LAITURI_SEED?.trim().toLowerCase() !== "off";
}

export function seedStatus(): SeedStatus {
  return holder.__laituriSeedStatus ?? (seedEnabled() ? { state: "skipped", reason: "Not attempted yet." } : { state: "off" });
}

/**
 * The real engines, with the recorded catalogue and the recorded wholesaler answers moved to the seeded days,
 * and offers that hold their price as long as the request being played asks.
 */
function seedDeps(upstream: SeedUpstream, hold: OfferHold): Deps {
  const real = realDeps();
  return {
    catalog: fixtureCatalog(),
    upstream,
    trust: real.trust,
    store: real.store,
    audit: real.audit,
    policy: real.policy,
    mandates: real.mandates,
    hash: real.hash,
    now: real.now,
    audience: real.audience,
    offerValidityMs: () => hold.validityMs,
  };
}

/**
 * Writes the demo history through the real gateway: four weeks of the three buyers' standing weekly orders, then
 * about a week of their one-off requests. Every offer, order, approval and audit entry is signed and chained as in
 * live use, at past times, and marked seeded.
 */
export async function seedHistory(): Promise<{ requests: number; orders: number }> {
  const end = now();
  // Mandates are issued at the real time, so they are in force across the whole seeded week.
  for (const buyerId of buyerIds()) await currentMandate(buyerId);
  const upstream = new SeedUpstream(new RecordedUpstream());
  const clock: SeedClock = { current: end };
  const hold: OfferHold = {};
  const gateway = createGateway(seedDeps(upstream, hold));
  const ctx: PlayContext = {
    gateway,
    upstream,
    clock,
    hold,
    async agentFor(buyerId, client) {
      const { mandate } = await currentMandate(buyerId);
      return { ...mandate.agent, buyer: { id: mandate.buyer.id, name: mandate.buyer.name }, client };
    },
  };
  const timeline = SEED_REQUESTS.map((request) => ({ request, start: startOf(request.when, end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  let orders = 0;
  let basketLines = 0;
  await asSeeded(() =>
    withClock(() => clock.current, async () => {
      basketLines = await playWeeklyOrders(end, ctx);
      for (const [index, { request, start }] of timeline.entries()) {
        // One run per request, titled with the buyer's own words, so a run that only searched still reads as what was asked.
        const run = { id: `run_seed_${index + 1}`, title: request.words };
        if (await inRun(run, () => playRequest(request, start, ctx))) orders += 1;
      }
    }),
  );
  // With four weeks of history in place, the demo customer's agent reorders what it bought before alone and asks a
  // person about a product it has never bought. Tests and evals start from an empty history and keep the default.
  await updateMandate({ approval: { firstTimeProducts: true } }, PRIMARY_BUYER_ID);
  // Every basket line is one request and one order through the gateway.
  return { requests: timeline.length + basketLines, orders: orders + basketLines };
}

/**
 * Writes the history in memory under the current workspace's id, so every signature is bound to it, then saves it
 * into the workspace in one write: a store on disk would otherwise flush once per audit entry.
 */
async function seedInMemory(): Promise<{ requests: number; orders: number }> {
  const target = currentWorkspace();
  const scratch = newWorkspace({ id: target.id, kind: target.kind, label: target.label, store: createVolatileStore() });
  const written = await inWorkspace(scratch, () => seedHistory());
  await target.store.replaceState(scratch.store.copyState());
  for (const [name, slot] of inheritedSlots(scratch)) target.slots.set(name, slot);
  return written;
}

/** Seeds when the store holds no orders and no audit entries; records what happened for the health check. */
export async function seedIfEmpty(): Promise<SeedStatus> {
  holder.__laituriSeedStatus = await attempt();
  return holder.__laituriSeedStatus;
}

async function attempt(): Promise<SeedStatus> {
  if (!seedEnabled()) return { state: "off" };
  const [orders, audit] = await Promise.all([store().orders.list(), store().audit.list()]);
  if (orders.length > 0 || audit.length > 0) return { state: "skipped", reason: "The state already holds orders or audit entries." };
  try {
    const at = now().toISOString();
    return { state: "seeded", at, ...(await seedInMemory()) };
  } catch (error) {
    return { state: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}
