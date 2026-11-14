/** The screen reads the contract's own shapes; only the planner's request union gets a narrower name here. */
import type { MenuOption, MenuPlanRequest } from "@/lib/contracts";

export type {
  BasketLineRequest,
  BasketUnit,
  Course,
  CreateBasketRequest,
  MenuOption,
  MenuPlan,
  MenuPlanRequest as PlanRequest,
  Recipe,
  RecipeSummary,
  ShoppingLine,
  Suggestion,
} from "@/lib/contracts";

/** The structured way to ask: guests, day and the rest. */
export type PlanDetails = Exclude<MenuPlanRequest, { words: string }>;

export type Tier = MenuOption["tier"];
export type SuggestionKind = "weekly_due" | "event" | "drift" | "low_pantry" | "seasonal";

/** Any amount the screen prints: a kitchen amount or a basket quantity. */
export interface Amount {
  amount: number;
  unit: string;
}
