import type { Mandate, RuleId } from "@/lib/contracts";

/** alone: the agent orders by itself. asks: the order waits for a person. never: blocked, nobody approves it. */
export type Tier = "alone" | "asks" | "never";

export interface AutonomyItem {
  tier: Tier;
  /** The rule that decides it, so the sentence is tied to what the policy actually checks. */
  rule: RuleId;
  /** One plain line a buyer reads. */
  text: string;
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const money = (amount: number) => `€${whole.format(amount)}`;
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

type Says = (mandate: Mandate) => [Tier, string][];

/**
 * What each rule means for the agent's freedom under one mandate. A Record over every rule id, so a new rule cannot
 * be added without saying here whether the agent may act alone, must ask or never may. Checks of signatures, prices
 * and the record say nothing a buyer chooses, so they add no line.
 */
const SAYS: Record<RuleId, Says> = {
  "mandate.signature": () => [["never", "Orders when your rules are not signed"]],
  "mandate.validity": () => [],
  "offer.signature": () => [["never", "Uses a price Valio Aimo did not sign"]],
  "offer.expiry": () => [],
  "audit.integrity": () => [],
  "product.first_time": (m) =>
    m.approval.firstTimeProducts
      ? [["alone", "Products you bought before"], ["asks", "New products"]]
      : [["alone", "Any product, new ones too"]],
  "spend.per_order": (m) => [["alone", `Up to ${money(m.limits.perOrder.amount)} an order`], ["asks", `An order over ${money(m.limits.perOrder.amount)}`]],
  "spend.per_week": (m) => [["alone", `Up to ${money(m.limits.perWeek.amount)} a week`], ["asks", `A week over ${money(m.limits.perWeek.amount)}`]],
  "category.allowed": (m) => [["asks", `Food outside your ${m.categories.allowed.length} kinds`]],
  "dietary.allergens": (m) =>
    m.dietary.excludeAllergens.length ? [["never", "Food with your allergens"], ["asks", "Missing allergen data"]] : [],
  "dietary.claims": (m) => (m.dietary.requiredClaims.length ? [["never", "Food without your kitchen's labels"]] : []),
  "substitution.policy": (m) => {
    if (m.substitution.policy === "none") return [["never", "Swaps a product"]];
    if (m.substitution.policy === "like_for_like") return [["alone", "Same-kind swaps when stock is short"], ["asks", "Swaps that change the product"]];
    return [["alone", "Swaps inside your rules"]];
  },
  "substitution.price": (m) => (m.substitution.policy === "none" ? [] : [["asks", `Swaps over ${m.substitution.maxPriceIncreasePct}% dearer`]]),
  "delivery.partial": (m) => (m.delivery.allowPartial ? [["alone", "Part deliveries"]] : [["asks", "Part deliveries"]]),
  "delivery.deadline": (m) =>
    m.delivery.maxDelayDays > 0 ? [["asks", `Deliveries up to ${days(m.delivery.maxDelayDays)} late`]] : [["never", "Late deliveries"]],
  "match.confidence": () => [["asks", "Unclear requests"]],
  "request.words": () => [],
  "product.never_buy": (m) => ((m.dietary.neverBuy?.products.length ?? 0) + (m.dietary.neverBuy?.words.length ?? 0) ? [["never", "Your never-buy list"]] : []),
};

/** Who decides what under this mandate, in rule order with the history rule first: two columns and a never list. */
export function autonomyOf(mandate: Mandate): Record<Tier, AutonomyItem[]> {
  const order: RuleId[] = ["product.first_time", ...(Object.keys(SAYS) as RuleId[]).filter((rule) => rule !== "product.first_time")];
  const out: Record<Tier, AutonomyItem[]> = { alone: [], asks: [], never: [] };
  for (const rule of order) {
    for (const [tier, text] of SAYS[rule](mandate)) out[tier].push({ tier, rule, text });
  }
  return out;
}
