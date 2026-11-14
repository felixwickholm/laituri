import type { Check, Decision, Mandate } from "@/lib/contracts";
import type { Deps } from "@/lib/gateway/types";
import type { MandateService, PolicyEngine, PolicyInput } from "@/lib/orders/types";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { FakeTrust, FakeUpstream, fakeAudit, fakeCatalog, memoryStore, sha256 } from "./fakes";
import { NOW } from "./products";

export const AGENT = { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };
export const BUYER = { id: "buyer:harbour", name: "Nordic Harbour Hotels" };
/** The quote context of the test mandate's buyer. */
export const QUOTE_CONTEXT = { customerNumber: "123", buyer: BUYER };

export function testMandate(): Mandate {
  return {
    id: "mandate:test",
    version: 1,
    buyer: { ...BUYER, customerNumber: "123" },
    agent: AGENT,
    supplier: "Valio Aimo",
    validFrom: "2026-11-01T00:00:00+02:00",
    validUntil: "2026-11-30T00:00:00+02:00",
    limits: { perOrder: { amount: 1500, currency: "EUR" }, perWeek: { amount: 5000, currency: "EUR" } },
    categories: { allowed: ["dairy"] },
    dietary: { excludeAllergens: ["nuts"], blockMayContain: false, requiredClaims: [] },
    substitution: { policy: "like_for_like", maxPriceIncreasePct: 10 },
    delivery: { allowPartial: false, maxDelayDays: 1 },
    approval: { approver: { id: "user:maria", name: "Maria Lind" }, firstTimeProducts: false, requireRequestWords: true },
  };
}

export function fakeMandates(trust: FakeTrust): MandateService {
  let current = testMandate();
  let jws: string | undefined;
  const issue = async () => (jws = await trust.sign("buyer", { jti: current.id, mandate: current }, TOKEN_TYPE.mandate));
  return {
    async read(token) {
      const verified = await trust.verify<{ mandate: Mandate }>("buyer", token, TOKEN_TYPE.mandate);
      if (!verified.valid || !verified.payload) return { valid: false, reason: "The mandate signature is not valid." };
      return { valid: true, mandate: verified.payload.mandate };
    },
    async current() {
      return { mandate: current, jws: jws ?? (await issue()) };
    },
    async update(patch) {
      current = { ...current, ...(patch as Partial<Mandate>), version: current.version + 1 };
      return { mandate: current, jws: await issue() };
    },
  };
}

/** Blocks on bad signatures, expiry and unorderable lines; asks above the per-order limit. */
export function stubPolicy(): PolicyEngine & { calls: PolicyInput[] } {
  const calls: PolicyInput[] = [];
  return {
    calls,
    evaluate(input): Decision {
      calls.push(input);
      const checks: Check[] = [];
      const add = (rule: Check["rule"], status: Check["status"], message: string) => checks.push({ rule, status, message });
      const mandate = input.mandate.valid ? input.mandate.mandate : undefined;
      const offer = input.offer.valid ? input.offer.offer : undefined;
      add("mandate.signature", mandate ? "pass" : "block", mandate ? "Mandate signed." : "The mandate signature is not valid.");
      add("offer.signature", offer ? "pass" : "block", offer ? "Offer signed." : "The offer signature is not valid.");
      if (offer) {
        const expired = input.now.getTime() > Date.parse(input.heldUntil ?? offer.expiresAt);
        const unorderable = offer.lines.some((l) => ["cutoff_passed", "unavailable", "blocked"].includes(l.availability.status));
        add("offer.expiry", expired || unorderable ? "block" : "pass", expired ? "The offer expired." : "Offer valid.");
      }
      if (offer && mandate) {
        const over = offer.totals.net.amount > mandate.limits.perOrder.amount;
        add("spend.per_order", over ? "ask" : "pass", over ? "The order is above the per-order limit." : "Within limit.");
      }
      const outcome = checks.some((c) => c.status === "block")
        ? "blocked"
        : checks.some((c) => c.status === "ask")
          ? "needs_approval"
          : "auto_approved";
      return { outcome, checks };
    },
  };
}

/** The workspace audience offers and mandates are signed for in unit tests. */
export const TEST_AUDIENCE = "laituri:workspace:test";

export function makeDeps(overrides: Partial<Deps> = {}) {
  const trust = new FakeTrust();
  const upstream = new FakeUpstream();
  const store = memoryStore();
  const audit = fakeAudit(store);
  const policy = stubPolicy();
  const clock = { current: new Date(NOW) };
  const deps: Deps = {
    catalog: fakeCatalog(),
    upstream,
    trust,
    store,
    audit,
    policy,
    mandates: fakeMandates(trust),
    hash: sha256,
    now: () => clock.current,
    audience: () => TEST_AUDIENCE,
    ...overrides,
  };
  return { deps, trust, upstream, store, audit, policy, clock };
}
