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
  it("lists every check in rule order", () => {
    const decision = evaluate(input());
    expect(decision.checks.map((c) => c.rule)).toEqual(RuleId.options);
    expect(decision.outcome).toBe("auto_approved");
  });

  it("skips dependent checks when the mandate is invalid", () => {
    const decision = evaluate(input({ mandateValid: false }));
    expect(decision.checks).toHaveLength(RuleId.options.length);
    expect(decision.outcome).toBe("blocked");
    expect(decision.checks.find((c) => c.rule === "spend.per_order")).toMatchObject({
      status: "skipped",
      message: "Not checked. The mandate is not valid.",
    });
    expect(decision.checks.find((c) => c.rule === "offer.expiry")?.status).toBe("pass");
  });

  it("skips dependent checks when the offer is invalid", () => {
    const decision = evaluate(input({ offerValid: false }));
    expect(decision.checks).toHaveLength(RuleId.options.length);
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
    // A line the offer delivers none of (the product a swap replaces) is not a new product the buyer gets.
    const swapped = offer({}, [line({ quantity: 0 }), line({ productId: "464401", quantity: 10 })]);
    expect(statusOf("product.first_time", input({ mandate: ask, offer: swapped, ordered: ["464401"] }))).toBe("pass");
  });
});

describe("the buyer's words must come with the quote", () => {
  it("sends an offer quoted without the buyer's words to a person, by name", () => {
    const check = checkOf("request.words", input({ offer: offer({ requestCheck: undefined }) }));
    expect(check).toMatchObject({
      status: "ask",
      message: "The agent did not state what the buyer asked for, so the offer could not be checked against it.",
    });
  });

  it("passes an offer that carries the request check, and a mandate that does not ask for the words", () => {
    expect(statusOf("request.words", input())).toBe("pass");
    const relaxed = mandate({ approval: { ...base.approval, requireRequestWords: false } });
    expect(statusOf("request.words", input({ mandate: relaxed, offer: offer({ requestCheck: undefined }) }))).toBe("pass");
  });
});

describe("a broken audit log pauses automatic confirmation", () => {
  it("asks a person, naming why, while the log does not verify", () => {
    const decision = evaluate(input({ auditLog: { valid: false, reason: "Entry 4 was changed after it was written." } }));
    expect(decision.outcome).toBe("needs_approval");
    expect(checkOf("audit.integrity", input({ auditLog: { valid: false, reason: "Entry 4 was changed after it was written." } })).message)
      .toBe("The audit log does not verify, so no order is confirmed alone until it does. Entry 4 was changed after it was written.");
  });
});

describe("a waiting order's price hold", () => {
  it("keeps the offer good past its own expiry until the hold ends, and not after", () => {
    const expired = offer({ expiresAt: "2026-11-14T06:00:00.000Z" });
    expect(statusOf("offer.expiry", input({ offer: expired }))).toBe("block");
    expect(statusOf("offer.expiry", input({ offer: expired, heldUntil: "2026-11-15T10:00:00.000Z" }))).toBe("pass");
    expect(checkOf("offer.expiry", input({ offer: expired, heldUntil: "2026-11-14T06:30:00.000Z" })).message).toMatch(/price hold ended/);
  });

  it("blocks an offer whose stock this workspace's other orders took since", () => {
    const check = checkOf("offer.expiry", input({ stockTaken: "Only 21 units of Arla milk are left after this workspace's other orders. Ask for a new quote." }));
    expect(check).toMatchObject({ status: "block", message: expect.stringContaining("Only 21 units") });
  });
});

describe("a substitute the buyer's words named by brand", () => {
  it("is decided by the substitution rule, which names the swap, not by the request check", () => {
    const swapped = line({
      productId: "464401",
      name: "Valio Eila skimmed milk drink 1 l",
      substituteFor: { productId: "462775", name: "Arla milk drink 1 l UHT", reason: "short", likeForLike: true, priceChangePct: 2 },
    });
    const brandCheck = { requirement: "brand" as const, asked: '"arla"', offered: "another brand", result: "substituted" as const, certain: false };
    const data = input({ offer: offer({ fulfilment: "substituted", requestCheck: [brandCheck] }, [swapped]) });
    expect(statusOf("match.confidence", data)).toBe("pass");
    expect(checkOf("substitution.policy", data).message).toMatch(/Valio Eila skimmed milk drink 1 l replaces Arla milk drink 1 l UHT/);
    const none = mandate({ substitution: { policy: "none", maxPriceIncreasePct: 0 } });
    expect(statusOf("substitution.policy", { ...data, mandate: { valid: true, mandate: none } })).toBe("block");
  });
});

describe("untracked stock split over lines", () => {
  it("asks for a person on 2 x 3,000 l as it does on one 6,000 l line", () => {
    const untracked = (litres: number) =>
      line({ quantity: litres, content: { amount: litres, unit: "l" }, availability: { status: "available", requested: litres, stock: "untracked", deliveryDate: "2026-11-16" } });
    const wide = mandate({ limits: { perOrder: { amount: 1e6, currency: "EUR" }, perWeek: { amount: 1e7, currency: "EUR" } } });
    expect(statusOf("delivery.partial", input({ mandate: wide, offer: offer({}, [untracked(6000)]) }))).toBe("ask");
    expect(statusOf("delivery.partial", input({ mandate: wide, offer: offer({}, [untracked(3000), untracked(3000)]) }))).toBe("ask");
  });
});
