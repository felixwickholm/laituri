import type { Course, Occasion } from "@/lib/contracts";
import type { AdaptedDish } from "./adapt";

export type MenuKind = "buffet" | "two_course" | "three_course";

/** The courses each kind of menu serves, in order. */
export const STRUCTURES: Record<MenuKind, Course[]> = {
  buffet: ["main", "main", "side"],
  two_course: ["main", "side", "dessert"],
  three_course: ["starter", "main", "side", "dessert"],
};

/** On a buffet guests take some of both warm dishes, so each is planned at this share of a portion. */
export const BUFFET_MAIN_SHARE = 0.6;

/** The share of a full portion each guest eats of a dish of this course in this kind of menu. */
export function portionShare(kind: MenuKind, course: Course): number {
  return kind === "buffet" && course === "main" ? BUFFET_MAIN_SHARE : 1;
}

/** The recipe occasion tags that suit the event, best first. A celebration takes only dishes tagged for one. */
export function occasionsFor(occasion: string | undefined): Occasion[] {
  switch (occasion) {
    case "wedding":
    case "birthday":
    case "party":
    case "Christmas party":
      return ["celebration"];
    case "breakfast":
      return ["breakfast"];
    case "lunch":
    case "school lunch":
      return ["lunch"];
    case "buffet":
    case "conference":
      return ["buffet", "lunch"];
    default:
      return ["dinner"];
  }
}

/** A dish with its cost per portion and how many of its ingredients cannot arrive in full and in time. */
export interface CostedDish {
  dish: AdaptedDish;
  costPerPortion: number;
  unavailable: number;
}

/** Dishes of one course tagged for the event; any dish of the course only when none is tagged for it. */
function pool(dishes: CostedDish[], course: Course, occasions: Occasion[]): CostedDish[] {
  const ofCourse = dishes.filter((entry) => entry.dish.def.course === course);
  const suited = ofCourse.filter((entry) => entry.dish.def.occasions.some((tag) => occasions.includes(tag)));
  return suited.length ? suited : ofCourse;
}

/** A Christmas party puts Valio's Christmas dishes (season tag "joulu") first. */
const CHRISTMAS = /christmas|joulu/i;

/**
 * First by how much can arrive, then Valio's recipes before our own fallbacks, then Christmas dishes at a Christmas
 * party, then by fit to the occasion, then by cost.
 */
function ordered(dishes: CostedDish[], occasions: Occasion[], premium: boolean, christmas = false): CostedDish[] {
  const fit = (entry: CostedDish) => {
    const at = occasions.findIndex((tag) => entry.dish.def.occasions.includes(tag));
    return at < 0 ? occasions.length : at;
  };
  const seasonal = (entry: CostedDish) => (christmas && entry.dish.def.seasons?.includes("joulu") ? 0 : 1);
  return [...dishes].sort(
    (a, b) =>
      a.unavailable - b.unavailable ||
      Number(Boolean(a.dish.def.fallback)) - Number(Boolean(b.dish.def.fallback)) ||
      seasonal(a) - seasonal(b) ||
      fit(a) - fit(b) ||
      (premium ? b.costPerPortion - a.costPerPortion : a.costPerPortion - b.costPerPortion) ||
      a.dish.def.id.localeCompare(b.dish.def.id),
  );
}

const STARCH_ROLES = new Set(["potato_body", "starch_side", "rice_base", "pasta_base"]);

function starches(entry: CostedDish): string[] {
  return entry.dish.items.filter((item) => STARCH_ROLES.has(item.role)).map((item) => item.spec.words);
}

/** A side that repeats the starch already on the plate, such as mash next to a main with mash. */
function sharesStarch(side: CostedDish, picks: CostedDish[]): boolean {
  const onPlate = new Set(picks.flatMap(starches));
  return starches(side).some((words) => onPlate.has(words));
}

/** A wedding or a birthday ends with a cake when one fits: the mentor's cream cake. */
const CAKE_OCCASIONS = /wedding|birthday|anniversary/;

function isCake(entry: CostedDish): boolean {
  return /kakku|cake/i.test(`${entry.dish.def.name} ${entry.dish.def.nameFi ?? ""}`);
}

const PREMIUM: Record<MenuKind, boolean> = { buffet: false, two_course: false, three_course: true };

/** The side for a menu: one no other menu serves yet and that does not repeat the starch on the plate, if there is one. */
function pickSide(options: CostedDish[], picks: CostedDish[], usedSides: Set<string>): CostedDish | undefined {
  const fresh = options.filter((entry) => !usedSides.has(entry.dish.def.id));
  return (
    fresh.find((entry) => !sharesStarch(entry, picks)) ??
    options.find((entry) => !sharesStarch(entry, picks)) ??
    fresh[0] ??
    options[0]
  );
}

/**
 * Picks the dishes of each menu: a cheaper main for the buffet, the next one for two courses and the finest for three,
 * so the three menus differ, and a different side for each while there are sides to go round. When the other menus
 * have taken every safe main, a menu shares one rather than go without. A course with no safe dish at all is left out.
 */
export function chooseDishes(dishes: CostedDish[], kinds: MenuKind[], occasion: string | undefined): Map<MenuKind, CostedDish[]> {
  const occasions = occasionsFor(occasion);
  const christmas = CHRISTMAS.test(occasion ?? "");
  const usedMains = new Set<string>();
  const usedSides = new Set<string>();
  const chosen = new Map<MenuKind, CostedDish[]>();
  // The finest menu chooses its main first, so the cheaper menus take the others.
  for (const kind of [...kinds].sort((a, b) => Number(PREMIUM[b]) - Number(PREMIUM[a]))) {
    const picks: CostedDish[] = [];
    for (const course of STRUCTURES[kind]) {
      const options = ordered(pool(dishes, course, occasions), occasions, PREMIUM[kind] && course !== "side", christmas).filter(
        (entry) => !picks.includes(entry),
      );
      const freshMains = options.filter((entry) => !usedMains.has(entry.dish.def.id));
      // A second main on the buffet may only be a dish not yet served; a menu's only main may repeat another menu's.
      const hasMain = picks.some((entry) => entry.dish.def.course === "main");
      const pick =
        course === "main"
          ? (freshMains[0] ?? (hasMain ? undefined : options[0]))
          : course === "side"
            ? pickSide(options, picks, usedSides)
            : course === "dessert" && CAKE_OCCASIONS.test(occasion ?? "")
              ? (options.find(isCake) ?? options[0])
              : options[0];
      if (!pick) continue;
      if (course === "main") usedMains.add(pick.dish.def.id);
      if (course === "side") usedSides.add(pick.dish.def.id);
      picks.push(pick);
    }
    chosen.set(kind, picks);
  }
  return chosen;
}
