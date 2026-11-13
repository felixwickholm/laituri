import type { Rule } from "../context";
import { check, eur, toCents } from "../format";

export const spendPerOrder: Rule = {
  id: "spend.per_order",
  needs: "both",
  run: ({ mandate, offer }) => {
    const total = toCents(offer.totals.net.amount);
    const limit = toCents(mandate.limits.perOrder.amount);
    const extra = { observed: eur(total), limit: eur(limit) };
    return total > limit
      ? check("spend.per_order", "ask", `Order total ${eur(total)} is over the ${eur(limit)} limit.`, extra)
      : check("spend.per_order", "pass", `Order total ${eur(total)} is within the ${eur(limit)} limit.`, extra);
  },
};

export const spendPerWeek: Rule = {
  id: "spend.per_week",
  needs: "both",
  run: ({ mandate, offer, weekSpendNet }) => {
    const total = toCents(weekSpendNet) + toCents(offer.totals.net.amount);
    const limit = toCents(mandate.limits.perWeek.amount);
    const extra = { observed: eur(total), limit: eur(limit) };
    return total > limit
      ? check("spend.per_week", "ask", `This week's spend would be ${eur(total)}, over the ${eur(limit)} weekly limit.`, extra)
      : check("spend.per_week", "pass", `This week's spend would be ${eur(total)}, within the ${eur(limit)} weekly limit.`, extra);
  },
};
