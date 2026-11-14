import { mergedByProduct, untrackedOverReview } from "@/lib/offers/limits";
import type { Rule } from "../context";
import { check, plural } from "../format";

export const substitutionPolicy: Rule = {
  id: "substitution.policy",
  needs: "both",
  run: ({ mandate, offer }) => {
    const policy = mandate.substitution.policy;
    const subs = offer.lines.filter((line) => line.substituteFor);
    if (subs.length === 0) return check("substitution.policy", "pass", "No line is a substitute.", { observed: "none", limit: policy });
    const observed = plural(subs.length, "substitute");
    if (policy === "none") {
      return check("substitution.policy", "block", "The mandate does not allow substitutes.", { observed, limit: policy });
    }
    const unlike = subs.filter((line) => !line.substituteFor?.likeForLike);
    if (policy === "like_for_like" && unlike.length > 0) {
      return check("substitution.policy", "ask", `${unlike[0].name} is not a like-for-like substitute.`, { observed, limit: policy });
    }
    const swaps = subs.map((line) => `${line.name} replaces ${line.substituteFor?.name}`).join("; ");
    const why = policy === "like_for_like"
      ? "Another product, or another brand, of the same kind with every claim kept is allowed under like-for-like."
      : "The mandate allows any substitute within its rules.";
    return check("substitution.policy", "pass", `${swaps}. ${why}`, { observed, limit: policy });
  },
};

export const substitutionPrice: Rule = {
  id: "substitution.price",
  needs: "both",
  run: ({ mandate, offer }) => {
    const max = mandate.substitution.maxPriceIncreasePct;
    const limit = `+${max} %`;
    const subs = offer.lines.filter((line) => line.substituteFor);
    if (subs.length === 0) return check("substitution.price", "pass", "No line is a substitute.", { observed: "none", limit });
    const worst = subs.reduce((a, b) => ((b.substituteFor?.priceChangePct ?? 0) > (a.substituteFor?.priceChangePct ?? 0) ? b : a));
    const pct = worst.substituteFor?.priceChangePct ?? 0;
    const observed = `${pct > 0 ? "+" : ""}${round1(pct)} %`;
    // Compare in hundredths of a percent so 10.0 vs 10 never fails on float noise.
    if (Math.round(pct * 100) > Math.round(max * 100)) {
      return check("substitution.price", "ask", `${worst.name} costs ${round1(pct)} % more, above the ${max} % limit.`, { observed, limit });
    }
    return check("substitution.price", "pass", `The largest substitute price change is ${observed}, within the ${max} % limit.`, { observed, limit });
  },
};

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

export const deliveryPartial: Rule = {
  id: "delivery.partial",
  needs: "both",
  run: ({ mandate, offer }) => {
    const short = offer.lines.filter(
      (line) => line.availability.status === "partial" || (line.availability.available ?? Infinity) < line.availability.requested,
    );
    const partial = offer.fulfilment === "partial" || short.length > 0;
    const limit = mandate.delivery.allowPartial ? "partial allowed" : "full delivery only";
    // Lines of one product count together, so splitting a quantity over two lines does not avoid the review.
    const unvouched = mergedByProduct(offer.lines).map((line) => ({ line, quantity: untrackedOverReview(line) })).find(({ quantity }) => quantity);
    if (!partial && unvouched) {
      return check(
        "delivery.partial",
        "ask",
        `The wholesaler does not track stock of ${unvouched.line.name}, so ${unvouched.quantity} cannot be promised without a person.`,
        { observed: "untracked stock", limit },
      );
    }
    if (!partial) return check("delivery.partial", "pass", "The offer covers the full quantity.", { observed: "full", limit });
    const what = short.length ? `${plural(short.length, "line")} cannot be delivered in full.` : "The offer does not cover the full quantity.";
    if (mandate.delivery.allowPartial) {
      return check("delivery.partial", "pass", `${what} The mandate allows that.`, { observed: "partial", limit });
    }
    return check("delivery.partial", "ask", what, { observed: "partial", limit });
  },
};

const DAY_MS = 86_400_000;

export const deliveryDeadline: Rule = {
  id: "delivery.deadline",
  needs: "both",
  run: ({ mandate, offer }) => {
    const dates = offer.lines.map((line) => line.availability.deliveryDate).filter((d): d is string => Boolean(d));
    const date = offer.deliveryDate ?? dates.sort().at(-1);
    const maxDelay = mandate.delivery.maxDelayDays;
    const limit = `${offer.deliverBy} (+${plural(maxDelay, "day")})`;
    if (!date) return check("delivery.deadline", "block", "The offer has no delivery date.", { observed: "none", limit });
    const late = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${offer.deliverBy}T00:00:00Z`)) / DAY_MS);
    const observed = date;
    if (late <= 0) return check("delivery.deadline", "pass", `Delivery on ${date} meets the ${offer.deliverBy} deadline.`, { observed, limit });
    if (late <= maxDelay) {
      return check("delivery.deadline", "ask", `Delivery on ${date} is ${plural(late, "day")} after the ${offer.deliverBy} deadline.`, { observed, limit });
    }
    return check(
      "delivery.deadline",
      "block",
      `Delivery on ${date} is ${plural(late, "day")} late, more than the ${plural(maxDelay, "day")} allowed.`,
      { observed, limit },
    );
  },
};
