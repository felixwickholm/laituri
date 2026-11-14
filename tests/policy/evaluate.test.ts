import { describe, expect, it } from "vitest";
import { RuleId, type CheckStatus } from "@/lib/contracts";
import { evaluate, type EvaluateInput } from "@/lib/policy";
import { input, line, mandate, offer, product } from "./fixtures";

function statusOf(rule: RuleId, data: EvaluateInput): CheckStatus {
  return checkOf(rule, data).status;
}

function checkOf(rule: RuleId, data: EvaluateInput) {
  const found = evaluate(data).checks.find((c) => c.rule === rule);
  if (!found) throw new Error(`missing ${rule}`);
  return found;
}

const base = mandate();

describe("policy outcome", () => {
  it("lists all 15 checks in rule order", () => {
    const decision = evaluate(input());
    expect(decision.checks.map((c) => c.rule)).toEqual(RuleId.options);
    expect(decision.outcome).toBe("auto_approved");
  });

  it("skips dependent checks when the mandate is invalid", () => {
    const decision = evaluate(input({ mandateValid: false }));
    expect(decision.checks).toHaveLength(15);
    expect(decision.outcome).toBe("blocked");
    expect(decision.checks.find((c) => c.rule === "spend.per_order")).toMatchObject({
      status: "skipped",
      message: "Not checked. The mandate is not valid.",
    });
    expect(decision.checks.find((c) => c.rule === "offer.expiry")?.status).toBe("pass");
  });

  it("skips dependent checks when the offer is invalid", () => {
    const decision = evaluate(input({ offerValid: false }));
    expect(decision.checks).toHaveLength(15);
    expect(decision.checks.find((c) => c.rule === "offer.signature")?.status).toBe("block");
    expect(decision.checks.find((c) => c.rule === "match.confidence")?.message).toBe("Not checked. The offer is not valid.");
  });

  it("puts block above ask", () => {
    const data = input({ offer: offer({ totals: { net: { amount: 2000, currency: "EUR" }, tax: { amount: 0, currency: "EUR" }, gross: { amount: 2000, currency: "EUR" } }, expiresAt: "2026-11-14T06:00:00.000Z" }) });
    expect(evaluate(data).outcome).toBe("blocked");
  });

  it("asks when only ask checks fail", () => {
    expect(evaluate(input({ offer: offer({ matchConfidence: "low" }) })).outcome).toBe("needs_approval");
  });
});

describe("policy rules", () => {
  it("mandate.signature", () => {
    expect(statusOf("mandate.signature", input())).toBe("pass");
    expect(statusOf("mandate.signature", input({ mandateValid: false }))).toBe("block");
  });

  it("mandate.validity", () => {
    expect(statusOf("mandate.validity", input())).toBe("pass");
    expect(statusOf("mandate.validity", input({ mandate: mandate({ validUntil: "2026-11-10T00:00:00.000Z" }) }))).toBe("block");
    expect(statusOf("mandate.validity", input({ agentId: "agent:other" }))).toBe("block");
    expect(statusOf("mandate.validity", input({ offer: offer({ customerNumber: "999" }) }))).toBe("block");
  });

  it("offer.signature", () => {
    expect(statusOf("offer.signature", input())).toBe("pass");
    expect(statusOf("offer.signature", input({ offerValid: false }))).toBe("block");
  });

  it("offer.expiry", () => {
    expect(statusOf("offer.expiry", input())).toBe("pass");
    expect(statusOf("offer.expiry", input({ offer: offer({ expiresAt: "2026-11-14T06:59:00.000Z" }) }))).toBe("block");
    const cut = line({ availability: { status: "cutoff_passed", requested: 100, available: 0 } });
    expect(statusOf("offer.expiry", input({ offer: offer({}, [cut]) }))).toBe("block");
  });

  it("spend.per_order", () => {
    const at = (amount: number) => offer({ totals: { net: { amount, currency: "EUR" }, tax: { amount: 0, currency: "EUR" }, gross: { amount, currency: "EUR" } } });
    const pass = checkOf("spend.per_order", input({ offer: at(1010) }));
    expect(pass).toMatchObject({ status: "pass", message: "Order total 1,010.00 EUR is within the 1,500.00 EUR limit.", observed: "1,010.00 EUR", limit: "1,500.00 EUR" });
    expect(statusOf("spend.per_order", input({ offer: at(1500) }))).toBe("pass");
    expect(statusOf("spend.per_order", input({ offer: at(1500.01) }))).toBe("ask");
  });

  it("spend.per_week", () => {
    expect(statusOf("spend.per_week", input({ weekSpendNet: 4899 }))).toBe("pass");
    expect(statusOf("spend.per_week", input({ weekSpendNet: 4899.01 }))).toBe("ask");
  });

  it("category.allowed", () => {
    expect(statusOf("category.allowed", input())).toBe("pass");
    expect(statusOf("category.allowed", input({ offer: offer({}, [line({ categoryGroup: "frozen" })]) }))).toBe("ask");
  });

  it("dietary.allergens", () => {
    expect(statusOf("dietary.allergens", input())).toBe("pass");
    const nutty = product({ allergens: { contains: ["nuts"], mayContain: [], freeFrom: [] } });
    expect(statusOf("dietary.allergens", input({ products: [nutty] }))).toBe("block");
    const traces = product({ allergens: { contains: [], mayContain: ["peanut"], freeFrom: [] } });
    expect(statusOf("dietary.allergens", input({ products: [traces] }))).toBe("pass");
    const strict = mandate({ dietary: { ...base.dietary, blockMayContain: true } });
    expect(statusOf("dietary.allergens", input({ products: [traces], mandate: strict }))).toBe("block");
    expect(statusOf("dietary.allergens", input({ products: [] }))).toBe("block");
  });

  it("dietary.claims", () => {
    const needs = (claims: string[]) => mandate({ dietary: { ...base.dietary, requiredClaims: claims } });
    expect(statusOf("dietary.claims", input())).toBe("pass");
    expect(statusOf("dietary.claims", input({ mandate: needs(["lactose_free"]) }))).toBe("pass");
    expect(statusOf("dietary.claims", input({ mandate: needs(["vegan"]) }))).toBe("block");
  });

  it("substitution.policy", () => {
    const sub = (likeForLike: boolean) => offer({}, [line({ substituteFor: { productId: "1", name: "x", reason: "out", likeForLike, priceChangePct: 5 } })]);
    const policy = (p: "none" | "like_for_like" | "any_within_rules") => mandate({ substitution: { policy: p, maxPriceIncreasePct: 10 } });
    expect(statusOf("substitution.policy", input())).toBe("pass");
    expect(statusOf("substitution.policy", input({ offer: sub(true) }))).toBe("pass");
    expect(statusOf("substitution.policy", input({ offer: sub(false) }))).toBe("ask");
    expect(statusOf("substitution.policy", input({ offer: sub(false), mandate: policy("any_within_rules") }))).toBe("pass");
    expect(statusOf("substitution.policy", input({ offer: sub(true), mandate: policy("none") }))).toBe("block");
  });

  it("substitution.price", () => {
    const sub = (pct: number) => offer({}, [line({ substituteFor: { productId: "1", name: "x", reason: "out", likeForLike: true, priceChangePct: pct } })]);
    expect(statusOf("substitution.price", input({ offer: sub(10) }))).toBe("pass");
    expect(statusOf("substitution.price", input({ offer: sub(10.5) }))).toBe("ask");
  });

  it("delivery.partial", () => {
    const short = offer({ fulfilment: "partial" }, [line({ availability: { status: "partial", requested: 100, available: 51, deliveryDate: "2026-11-16" } })]);
    expect(statusOf("delivery.partial", input())).toBe("pass");
    expect(statusOf("delivery.partial", input({ offer: short }))).toBe("ask");
    const allow = mandate({ delivery: { allowPartial: true, maxDelayDays: 1 } });
    expect(statusOf("delivery.partial", input({ offer: short, mandate: allow }))).toBe("pass");
  });

  it("delivery.partial sends a large line on untracked stock to a person, and says why", () => {
    const untracked = (litres: number) =>
      offer({}, [line({ quantity: litres, content: { amount: litres, unit: "l" }, availability: { status: "available", requested: litres, stock: "untracked", deliveryDate: "2026-11-16" } })]);
    expect(statusOf("delivery.partial", input({ offer: untracked(1000) }))).toBe("pass");
    expect(checkOf("delivery.partial", input({ offer: untracked(6000) }))).toMatchObject({
      status: "ask",
      message: "The wholesaler does not track stock of Valio Arki lactose-free milk drink 1 l, so 6,000 l cannot be promised without a person.",
    });
    const allow = mandate({ delivery: { allowPartial: true, maxDelayDays: 1 } });
    expect(statusOf("delivery.partial", input({ offer: untracked(6000), mandate: allow }))).toBe("ask");
  });

  it("delivery.deadline", () => {
    expect(statusOf("delivery.deadline", input())).toBe("pass");
    expect(statusOf("delivery.deadline", input({ offer: offer({ deliveryDate: "2026-11-17" }) }))).toBe("ask");
    expect(statusOf("delivery.deadline", input({ offer: offer({ deliveryDate: "2026-11-18" }) }))).toBe("block");
  });

  it("match.confidence", () => {
    expect(statusOf("match.confidence", input())).toBe("pass");
    expect(statusOf("match.confidence", input({ offer: offer({ matchConfidence: "medium" }) }))).toBe("pass");
    expect(statusOf("match.confidence", input({ offer: offer({ matchConfidence: "low" }) }))).toBe("ask");
  });

  it("product.first_time", () => {
    const ask = mandate({ approval: { ...base.approval, firstTimeProducts: true } });
    expect(statusOf("product.first_time", input({ ordered: [] }))).toBe("pass");
    expect(statusOf("product.first_time", input({ mandate: ask }))).toBe("pass");
    expect(statusOf("product.first_time", input({ mandate: ask, ordered: [] }))).toBe("ask");
  });
});
