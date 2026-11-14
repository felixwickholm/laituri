import type { DietaryNeed, Mandate, MenuOption, Product } from "@/lib/contracts";
import { day, eur } from "@/lib/offers/format";
import { GLUTEN_ALLERGENS } from "@/lib/recipes";
import type { AdaptedDish } from "./adapt";
import { kindAllowed, missingClaims, productSafe, type DietRules } from "./dietary";
import type { PricedLine } from "./shopping";

type Fit = MenuOption["fits"][number];

const NEED_FITS: Record<DietaryNeed, { ok: string; allergens: string[] }> = {
  nut_free: { ok: "No nuts in any dish.", allergens: ["nuts", "almond", "peanut"] },
  peanut_free: { ok: "No peanuts in any dish.", allergens: ["peanut"] },
  gluten_free: { ok: "Every dish is gluten-free.", allergens: GLUTEN_ALLERGENS },
  lactose_free: { ok: "Every dish is lactose-free.", allergens: ["lactose"] },
  milk_free: { ok: "No milk in any dish.", allergens: ["milk", "lactose"] },
  egg_free: { ok: "No egg in any dish.", allergens: ["egg"] },
  fish_free: { ok: "No fish in any dish.", allergens: ["fish"] },
  sesame_free: { ok: "No sesame in any dish.", allergens: ["sesame"] },
  soy_free: { ok: "No soy in any dish.", allergens: ["soy"] },
  vegetarian: { ok: "Every dish is vegetarian.", allergens: [] },
  vegan: { ok: "Every dish is vegan.", allergens: [] },
};

export interface FitInput {
  needs: DietaryNeed[];
  rules: DietRules;
  mandate: Mandate;
  dishes: AdaptedDish[];
  lines: PricedLine[];
  /** Net EUR still to order after the kitchen's stock. */
  toOrderNet: number;
  /** What the mandate's weekly limit still allows this week, net EUR. */
  weekLeft: number;
  deliverBy: string;
  budgetPerGuest?: number;
  costPerGuest: number;
}

function bought(input: FitInput): Product[] {
  return input.lines.flatMap(({ picked }) => (picked ? [picked.product] : []));
}

/** One need, checked on the dishes as served and on every product chosen, traces included. */
function needFit(need: DietaryNeed, input: FitInput): Fit {
  const { ok, allergens } = NEED_FITS[need];
  const kindsOk = input.dishes.every((dish) => dish.items.every((item) => item.omitted || kindAllowed(item.spec.kind, input.rules)));
  const dishesOk = input.dishes.every((dish) => !dish.summary.allergens.some((allergen) => allergens.includes(allergen)));
  const productsOk = bought(input).every(
    (product) => !product.allergens.contains.some((a) => allergens.includes(a)) && !product.allergens.mayContain.some((a) => allergens.includes(a)),
  );
  return kindsOk && dishesOk && productsOk ? { ok: true, sentence: ok } : { ok: false, sentence: `Not met: ${ok.toLowerCase()} A person must check.` };
}

function mandateFit(input: FitInput): Fit | undefined {
  if (input.mandate.dietary.excludeAllergens.length === 0) return undefined;
  const safe = bought(input).every((product) => productSafe(product.allergens, input.rules));
  return safe
    ? { ok: true, sentence: "Every product meets your allergen rules." }
    : { ok: false, sentence: "A product breaks your allergen rules. A person must check." };
}

/** How a fit sentence names a label: "lactose-free". */
function labelWord(claim: string): string {
  return claim.replaceAll("_", "-");
}

function joinedWords(words: string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** The kitchen's required labels, checked on every product to order the way the policy will check the order. */
function claimsFit(input: FitInput): Fit | undefined {
  const required = input.rules.requiredClaims;
  if (!required.length) return undefined;
  const lacking = new Set(bought(input).filter((product) => missingClaims(product, required).length).map((product) => product.id));
  const labels = joinedWords(required.map(labelWord));
  if (lacking.size === 0) return { ok: true, sentence: `Every product is ${labels}.` };
  const many = lacking.size > 1;
  return { ok: false, sentence: `${lacking.size} ${many ? "products are" : "product is"} not labelled ${labels}. Your rules block ${many ? "them" : "it"}.` };
}

function spendFit(input: FitInput): Fit {
  const over = Math.round((input.toOrderNet - input.weekLeft) * 100) / 100;
  return over <= 0
    ? { ok: true, sentence: "The total is inside your weekly limit." }
    : { ok: false, sentence: `${eur(over)} over your weekly limit. A person approves it.` };
}

function categoryFit(input: FitInput): Fit {
  const outside = input.lines.filter(({ picked, line }) => picked?.outside && line.toOrder.amount > 0).length;
  if (outside === 0) return { ok: true, sentence: "Every product is in your agent's categories." };
  return { ok: false, sentence: `${outside} ${outside === 1 ? "product needs" : "products need"} a person: outside your categories.` };
}

function deliveryFit(input: FitInput): Fit {
  const late = input.lines.filter(({ line }) => line.availability !== "ok").length;
  if (late === 0) return { ok: true, sentence: `Everything can arrive by ${day(input.deliverBy)}.` };
  return { ok: false, sentence: `${late} ${late === 1 ? "item cannot" : "items cannot"} arrive in full by ${day(input.deliverBy)}.` };
}

function budgetFit(input: FitInput): Fit | undefined {
  if (input.budgetPerGuest === undefined) return undefined;
  const over = Math.round((input.costPerGuest - input.budgetPerGuest) * 100) / 100;
  return over <= 0
    ? { ok: true, sentence: `Under your ${eur(input.budgetPerGuest)} per guest.` }
    : { ok: false, sentence: `${eur(over)} per guest over your budget.` };
}

/** Checked facts about one menu, each one plain sentence, true or honestly false. */
export function menuFits(input: FitInput): Fit[] {
  return [
    ...input.needs.map((need) => needFit(need, input)),
    mandateFit(input),
    claimsFit(input),
    spendFit(input),
    categoryFit(input),
    deliveryFit(input),
    budgetFit(input),
  ].filter((fit): fit is Fit => fit !== undefined);
}
