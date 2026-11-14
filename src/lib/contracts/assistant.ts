import { z } from "zod";
import { CreateBasketRequest } from "./basket";
import { IsoDate } from "./common";
import { Course, KitchenAmount, LineAvailability, RecipeSource } from "./menu";

/** The event assistant: a kitchen explains its event in words or by voice; the answer is cards and one-tap actions. */

export const AssistantLanguage = z.enum(["fi", "en"]);
export type AssistantLanguage = z.infer<typeof AssistantLanguage>;

export const AssistantAsk = z.enum(["guests", "date", "diets", "choice"]);
export type AssistantAsk = z.infer<typeof AssistantAsk>;

export const AssistantTurnRequest = z.object({
  conversationId: z.string().trim().min(1).max(80).optional().describe("Leave out to start a new conversation"),
  words: z.string().trim().min(1).max(500).describe("What the kitchen said or typed, Finnish or English"),
  language: AssistantLanguage.optional().describe("A hint, for example the voice input's language"),
  menuId: z.string().max(80).optional().describe("The menu the kitchen tapped, from a choose_menu action"),
});
export type AssistantTurnRequest = z.infer<typeof AssistantTurnRequest>;

export const AssistantEventCard = z.object({
  kind: z.literal("event"),
  understood: z.string(),
  guests: z.number().int().optional(),
  date: IsoDate.optional(),
  occasion: z.string().optional(),
  dietary: z.array(z.string()),
  budgetPerGuest: z.number().optional(),
});

export const AssistantMenuCard = z.object({
  kind: z.literal("menu"),
  id: z.string().describe("The planner's menu id"),
  tier: z.enum(["good", "better", "best"]),
  label: z.string().describe("Simple, Classic or Special"),
  name: z.string(),
  tagline: z.string(),
  recommended: z.boolean(),
  chosen: z.boolean(),
  guests: z.number().int(),
  courses: z.array(z.object({ course: Course, recipeId: z.string(), name: z.string(), source: RecipeSource.optional() })),
  costPerGuest: z.number().describe("Indicative net EUR per guest, from the planner"),
  costNote: z.string().optional().describe("Set when the cost leaves out items without a price; show it with costPerGuest"),
  totalNet: z.number(),
  toOrderNet: z.number(),
  linesToOrder: z.number().int(),
  fits: z.array(z.object({ ok: z.boolean(), sentence: z.string() })),
  warnings: z.array(z.string()),
  changes: z.string().optional().describe("What changed since the guest count changed"),
});

export const AssistantRecipeCard = z.object({
  kind: z.literal("recipe"),
  id: z.string(),
  name: z.string(),
  course: Course,
  serves: z.number().int(),
  minutes: z.number().int().optional(),
  allergens: z.array(z.string()),
  labels: z.array(z.string()),
  why: z.string().optional().describe("Why the assistant proposes it: \"In your menu\", \"You have potatoes\""),
  source: RecipeSource.optional(),
});

export const AssistantShoppingCard = z.object({
  kind: z.literal("shopping"),
  menuId: z.string(),
  title: z.string(),
  deliverBy: IsoDate,
  toOrderNet: z.number(),
  lines: z.array(
    z.object({
      words: z.string(),
      product: z.string().optional(),
      toOrder: KitchenAmount,
      inPantry: KitchenAmount.optional(),
      estNet: z.number().optional(),
      availability: LineAvailability,
      swap: z.string().optional(),
    }),
  ),
});

export const AssistantCard = z.discriminatedUnion("kind", [AssistantEventCard, AssistantMenuCard, AssistantRecipeCard, AssistantShoppingCard]);
export type AssistantCard = z.infer<typeof AssistantCard>;
export type AssistantMenuCard = z.infer<typeof AssistantMenuCard>;
export type AssistantRecipeCard = z.infer<typeof AssistantRecipeCard>;
export type AssistantShoppingCard = z.infer<typeof AssistantShoppingCard>;
export type AssistantEventCard = z.infer<typeof AssistantEventCard>;

export const AssistantAction = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("order_menu"),
    menuId: z.string(),
    label: z.string(),
    basket: CreateBasketRequest.describe("Post as is to POST /api/v1/baskets"),
    now: z.boolean().optional().describe("The kitchen asked to order: the client places it without another tap"),
  }),
  z.object({ kind: z.literal("choose_menu"), menuId: z.string(), label: z.string() }),
  z.object({ kind: z.literal("open_recipe"), recipeId: z.string(), label: z.string(), url: z.string() }),
  z.object({ kind: z.literal("reply"), label: z.string(), words: z.string().describe("Send these words as the next turn") }),
]);
export type AssistantAction = z.infer<typeof AssistantAction>;

export const AssistantTurnLine = z.object({ from: z.enum(["kitchen", "assistant"]), words: z.string() });
export type AssistantTurnLine = z.infer<typeof AssistantTurnLine>;

export const AssistantTurn = z.object({
  conversationId: z.string(),
  language: AssistantLanguage,
  reply: z.string().describe("One or two short sentences in the kitchen's language"),
  asks: z.array(AssistantAsk).optional().describe("What the assistant still needs"),
  cards: z.array(AssistantCard),
  actions: z.array(AssistantAction),
  turns: z.array(AssistantTurnLine).describe("The last few turns, oldest first"),
  engine: z.enum(["gemini", "rules"]).describe("Who read the words; facts always come from the planner"),
  model: z.string().optional(),
});
export type AssistantTurn = z.infer<typeof AssistantTurn>;
