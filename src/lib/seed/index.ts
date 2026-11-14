import { fixtureCatalog } from "@/lib/catalog";
import { now, withClock } from "@/lib/clock";
import { createGateway } from "@/lib/gateway/gateway";
import { realDeps } from "@/lib/gateway/deps";
import type { Deps } from "@/lib/gateway/types";
import { buyerIds, currentMandate } from "@/lib/mandate";
import { asSeeded } from "@/lib/provenance";
import { store } from "@/lib/store";
import { RecordedUpstream } from "@/lib/valio/recorded";
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
    offerValidityMs: () => hold.validityMs,
  };
}

/**
 * Writes about a week of trade by the three demo buyers through the real gateway: every offer, order, approval
 * and audit entry is signed and chained as in live use, at past times, and marked seeded.
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
  await asSeeded(() =>
    withClock(() => clock.current, async () => {
      for (const { request, start } of timeline) {
        if (await playRequest(request, start, ctx)) orders += 1;
      }
    }),
  );
  return { requests: timeline.length, orders };
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
    return { state: "seeded", at, ...(await seedHistory()) };
  } catch (error) {
    return { state: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}
