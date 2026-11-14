import type { OfferLine, Product } from "@/lib/contracts";
import { describeCheck } from "@/lib/request";
import type { FullContext, Rule } from "../context";
import { check, listText, plural } from "../format";
import { neverBuyHit, neverBuyOf } from "../never-buy";

export const categoryAllowed: Rule = {
  id: "category.allowed",
  needs: "both",
  run: ({ mandate, offer }) => {
    const allowed = mandate.categories.allowed;
    const outside = offer.lines.filter((line) => !allowed.includes(line.categoryGroup));
    const limit = allowed.join(", ");
    if (outside.length > 0) {
      const groups = [...new Set(outside.map((line) => line.categoryGroup.replaceAll("_", " ")))];
      const verb = outside.length === 1 ? "is" : "are";
      return check("category.allowed", "ask", `${plural(outside.length, "line")} ${verb} in ${listText(groups)}, which the mandate does not allow.`, {
        observed: groups.join(", "),
        limit,
      });
    }
    const groups = [...new Set(offer.lines.map((line) => line.categoryGroup))];
    return check("category.allowed", "pass", `Every line is in an allowed category.`, { observed: groups.join(", "), limit });
  },
};

function productsOf(ctx: FullContext): { line: OfferLine; product?: Product }[] {
  return ctx.offer.lines.map((line) => ({ line, product: ctx.products.get(line.productId) }));
}

/** Fresh produce carries no allergen declaration by nature; every other food without one is unknown, not safe. */
const UNPROCESSED_GROUPS = new Set(["produce"]);

function hasNoDeclaration(product: Product): boolean {
  const { contains, mayContain, freeFrom } = product.allergens;
  return contains.length + mayContain.length + freeFrom.length === 0;
}

export const dietaryAllergens: Rule = {
  id: "dietary.allergens",
  needs: "both",
  run: (ctx) => {
    const { excludeAllergens: excluded, blockMayContain } = ctx.mandate.dietary;
    const limit = excluded.length ? `exclude ${excluded.join(", ")}${blockMayContain ? " (also may contain)" : ""}` : "none";
    if (excluded.length === 0) {
      return check("dietary.allergens", "pass", "The mandate excludes no allergens.", { limit });
    }
    let traces = 0;
    let undeclared: OfferLine | undefined;
    for (const { line, product } of productsOf(ctx)) {
      if (!product) {
        return check("dietary.allergens", "block", `Allergen data is missing for ${line.name}.`, { observed: line.productId, limit });
      }
      if (!undeclared && hasNoDeclaration(product) && !UNPROCESSED_GROUPS.has(line.categoryGroup)) undeclared = line;
      const contains = excluded.filter((a) => product.allergens.contains.includes(a));
      if (contains.length) {
        return check("dietary.allergens", "block", `${line.name} contains ${listText(contains)}.`, { observed: contains.join(", "), limit });
      }
      const may = excluded.filter((a) => product.allergens.mayContain.includes(a));
      if (may.length && blockMayContain) {
        return check("dietary.allergens", "block", `${line.name} may contain ${listText(may)}.`, { observed: may.join(", "), limit });
      }
      if (may.length) traces += 1;
    }
    if (undeclared) {
      return check("dietary.allergens", "ask", `${undeclared.name} has no allergen declaration. A person must check it.`, {
        observed: "no declaration",
        limit,
      });
    }
    const note = traces ? ` ${plural(traces, "line")} may contain traces.` : "";
    return check("dietary.allergens", "pass", `No line contains ${listText(excluded).replace(" and ", " or ")}.${note}`, { observed: "none", limit });
  },
};

export const dietaryClaims: Rule = {
  id: "dietary.claims",
  needs: "both",
  run: (ctx) => {
    const required = ctx.mandate.dietary.requiredClaims;
    const limit = required.length ? required.join(", ") : "none";
    if (required.length === 0) {
      return check("dietary.claims", "pass", "The mandate requires no product claims.", { limit });
    }
    for (const { line, product } of productsOf(ctx)) {
      if (!product) {
        return check("dietary.claims", "block", `Claim data is missing for ${line.name}.`, { observed: line.productId, limit });
      }
      const missing = required.filter((claim) => !product.claims.includes(claim));
      if (missing.length) {
        return check("dietary.claims", "block", `${line.name} does not carry ${listText(missing)}.`, { observed: missing.join(", "), limit });
      }
    }
    return check("dietary.claims", "pass", `Every line carries ${listText(required)}.`, { observed: "all present", limit });
  },
};

export const firstTimeProducts: Rule = {
  id: "product.first_time",
  needs: "both",
  run: ({ mandate, offer, orderedProductIds }) => {
    // A line the offer delivers none of (the product a swap replaces) is not a product the buyer gets.
    const fresh = offer.lines.filter((line) => line.quantity > 0 && !orderedProductIds.has(line.productId));
    const observed = `${plural(fresh.length, "new product")}`;
    if (!mandate.approval.firstTimeProducts) {
      return check("product.first_time", "pass", "New products do not need approval under this mandate.", { observed, limit: "not required" });
    }
    if (fresh.length > 0) {
      return check("product.first_time", "ask", `${plural(fresh.length, "product")} ${fresh.length === 1 ? "has" : "have"} not been ordered before.`, {
        observed: fresh.map((line) => line.productId).join(", "),
        limit: "approval for new products",
      });
    }
    return check("product.first_time", "pass", "Every product has been ordered before.", { observed, limit: "approval for new products" });
  },
};

/**
 * The buyer's never-buy list: a listed product, or one whose name carries a listed word, blocks the order. Every line
 * that delivers something counts, a swap included; a line the offer delivers none of does not.
 */
export const neverBuy: Rule = {
  id: "product.never_buy",
  needs: "both",
  run: ({ mandate, offer, products }) => {
    const list = neverBuyOf(mandate);
    const size = list.products.length + list.words.length;
    const limit = size ? `${plural(list.products.length, "product")}, ${plural(list.words.length, "word")}` : "none";
    if (size === 0) return check("product.never_buy", "pass", "Your never-buy list is empty.", { limit });
    for (const line of offer.lines) {
      if (line.quantity <= 0) continue;
      const product = products.get(line.productId);
      const hit = neverBuyHit(mandate, { id: line.productId, name: product?.name ?? line.name });
      if (hit) {
        const why = hit.by === "word" ? ` Its name has "${hit.entry}".` : "";
        return check("product.never_buy", "block", `${line.name} is on your never-buy list.${why}`, {
          observed: hit.by === "word" ? `${line.productId} (${hit.entry})` : line.productId,
          limit,
        });
      }
    }
    return check("product.never_buy", "pass", "No line is on your never-buy list.", { observed: "none", limit });
  },
};

/**
 * The offer against the buyer's words: a requirement the offer certainly fails blocks the order; one it does not meet,
 * or that cannot be checked, goes to a person, named; an uncertain product match goes to a person too.
 */
export const matchConfidence: Rule = {
  id: "match.confidence",
  needs: "offer",
  run: ({ offer }) => {
    const level = offer.matchConfidence;
    // A brand or product the offer substitutes is the substitution rule's to decide.
    const open = (offer.requestCheck ?? []).filter((item) => item.result === "unmet" || item.result === "unchecked");
    const extra = { observed: open.length ? open.map((item) => item.requirement).join(", ") : level, limit: "every requirement in the words met" };
    const certain = open.filter((item) => item.certain);
    if (certain.length) {
      return check("match.confidence", "block", `The offer does not match the request. ${certain.map(describeCheck).join(". ")}.`, extra);
    }
    if (open.length) {
      return check("match.confidence", "ask", `A person must confirm the offer against the request. ${open.map(describeCheck).join(". ")}.`, extra);
    }
    if (level === "low") return check("match.confidence", "ask", "The product match is uncertain, so a person should confirm it.", extra);
    if (level === "medium") return check("match.confidence", "pass", "The product match is likely but not certain.", extra);
    return check("match.confidence", "pass", "The product match is certain.", extra);
  },
};
