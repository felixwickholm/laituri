import { z } from "zod";
import { AssistantLanguage, DietaryNeed, IsoDate } from "@/lib/contracts";
import { isValidDate } from "@/lib/agent/dates";
import { admitModelCall } from "@/lib/agent/llm/budget";
import type { Understanding } from "./rules";

/**
 * Gemini reads the kitchen's words into a fixed shape (structured output). It never states a dish, a price, an
 * allergen or stock: those come from the planner and the recipe library. Its only free text is a short opener
 * without numbers, which is checked before use.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
/** Newest first. The first that answers is used; one out of quota rests for a while. */
export const DEFAULT_ASSISTANT_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const TIMEOUT_MS = 7_000;
const REST_AFTER_QUOTA_MS = 10 * 60_000;
const REST_AFTER_MISSING_MS = 60 * 60_000;

const INTENTS = ["event", "choose", "order", "recipes", "ideas", "reset", "human", "thanks", "other"] as const;
const CHOICES = ["good", "better", "best", "buffet", "two_course", "three_course"] as const;

export const ModelReading = z.object({
  language: AssistantLanguage.describe("fi when the kitchen wrote Finnish, else en"),
  intent: z.enum(INTENTS).describe(
    "event: describes or changes the event. choose: picks one of the menus shown. order: asks to order. recipes: asks for a recipe. " +
      "ideas: asks what to serve. reset: starts over. human: wants a person. thanks: closes. other: anything else",
  ),
  guests: z.number().int().min(1).max(2000).optional(),
  date: IsoDate.optional().describe("The event date, YYYY-MM-DD"),
  occasion: z.string().max(30).optional().describe("One English word or two: wedding, dinner, lunch, buffet, birthday, Christmas party"),
  dietary: z.array(DietaryNeed).describe("Needs the words state, also from 'two coeliacs' (gluten_free); empty when none"),
  noDietaryNeeds: z.boolean().optional().describe("True only when the kitchen says there are no allergies or special diets"),
  courses: z.number().int().min(1).max(6).optional(),
  budgetPerGuest: z.number().positive().max(500).optional().describe("Net euros per guest, when stated"),
  choice: z.enum(CHOICES).optional().describe("Which shown menu: good = Simple (cheapest), better = Classic, best = Special, or a kind"),
  recipeQuery: z.string().max(40).optional().describe("English words for a recipe search: salmon, cake, soup"),
  opener: z.string().max(70).optional().describe("At most eight warm words in the kitchen's language, no numbers, no dishes, no prices"),
});
export type ModelReading = z.infer<typeof ModelReading>;

export interface ModelContext {
  today: string;
  /** The event as known so far, and the menus on the table. */
  known: Record<string, unknown>;
  menus: { tier: string; label: string; name: string }[];
  recent: { from: string; words: string }[];
}

export interface Reader {
  model: string;
  read(words: string, context: ModelContext): Promise<ModelReading | undefined>;
}

type Env = Record<string, string | undefined>;

function system(context: ModelContext): string {
  return [
    `Today is ${context.today} in Finland. You read what a professional kitchen says to its purchasing assistant about an event, in Finnish or English.`,
    "Fill the JSON with what THIS message states, using the conversation only to resolve words like 'it', 'that one' or a bare number.",
    "A bare number answers the last question asked. Leave out any field the message does not state. Weekdays mean the next such day.",
    "Never name dishes, prices, allergens or stock. The opener is optional: a few friendly words, no numbers, for example 'Onnea hääpäivään!'.",
  ].join(" ");
}

function prompt(words: string, context: ModelContext): string {
  return JSON.stringify({ known: context.known, menusShown: context.menus, recentTurns: context.recent, message: words });
}

function thinking(model: string): Record<string, unknown> {
  return model.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" };
}

const holder = globalThis as typeof globalThis & { __laituriAssistantRest?: Map<string, number> };
const resting = (holder.__laituriAssistantRest ??= new Map<string, number>());

/** The JSON schema Gemini's structured output takes, from the zod shape. */
function responseSchema(): Record<string, unknown> {
  const schema = { ...(z.toJSONSchema(ModelReading, { io: "input" }) as Record<string, unknown>) };
  delete schema.$schema;
  delete schema.additionalProperties;
  return schema;
}

/**
 * Word stems, English and Finnish, that would make the opener state a diet, an allergen, a dish's safety or stock. Diets
 * and allergens come only from the planner and the recipe library, so an opener that touches one is dropped whole.
 */
const FACT_WORDS =
  /allerg|gluten|gluteen|keliak|coeliac|celiac|lacto|lakto|dairy|maito|maido|milk|\bnuts?\b|pähkin|peanut|vegan|vegaan|vegetar|kasvis|\begg|kananmun|\bmuna|\bfish|\bkala|shellfish|äyriäi|\bsoy|soija|sesam|seesam|halal|kosher|\bdiet|ruokavalio|\bfree\b|-free|ton\b|tön\b|\bsafe|turvalli|\bstock|varasto/i;

/** Keeps only what parses; a date in the past or not on the calendar is dropped, not trusted. */
export function cleanReading(raw: unknown, today: string): ModelReading | undefined {
  const parsed = ModelReading.safeParse(raw);
  if (!parsed.success) return undefined;
  const reading = { ...parsed.data };
  if (reading.date && (!isValidDate(reading.date) || reading.date < today)) delete reading.date;
  if (reading.opener && (/\d|€|eur/i.test(reading.opener) || FACT_WORDS.test(reading.opener) || reading.opener.length > 70)) delete reading.opener;
  return reading;
}

const Candidate = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }).loose()) }).optional() })).optional(),
});

/**
 * A reader over Gemini's REST API with structured output. Tries the models in order; a model out of quota (429) or
 * unknown to the key (404) rests and the next is tried. Undefined means: let the rules read the words.
 */
export function geminiReader(options: { apiKey: string; models: string[]; fetch?: typeof fetch; now?: () => number }): Reader {
  const clock = options.now ?? Date.now;
  let used = options.models[0] ?? "";
  return {
    get model() {
      return used;
    },
    async read(words, context) {
      const deadline = AbortSignal.timeout(TIMEOUT_MS);
      for (const model of options.models) {
        if ((resting.get(model) ?? 0) > clock()) continue;
        let response: Response;
        try {
          response = await (options.fetch ?? fetch)(`${API_ROOT}/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system(context) }] },
              contents: [{ role: "user", parts: [{ text: prompt(words, context) }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseJsonSchema: responseSchema(),
                maxOutputTokens: 600,
                temperature: 0.2,
                thinkingConfig: thinking(model),
              },
            }),
            signal: deadline,
          });
        } catch {
          return undefined;
        }
        if (response.status === 429 || response.status === 404 || response.status === 400) {
          resting.set(model, clock() + (response.status === 429 ? REST_AFTER_QUOTA_MS : REST_AFTER_MISSING_MS));
          continue;
        }
        if (!response.ok) continue;
        const body = Candidate.safeParse(await response.json().catch(() => undefined));
        const text = body.success ? body.data.candidates?.[0]?.content?.parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("") : undefined;
        if (!text) continue;
        try {
          const reading = cleanReading(JSON.parse(text), context.today);
          if (reading) {
            used = model;
            return reading;
          }
        } catch {
          // Not JSON: try the next model.
        }
      }
      return undefined;
    },
  };
}

/**
 * LAITURI_ASSISTANT_ENGINE is gemini or rules. Unset, it follows LAITURI_AGENT_ENGINE: scripted (tests, recorded
 * evals) means rules, so no test ever calls a model. No GEMINI_API_KEY: rules. LAITURI_ASSISTANT_MODEL may list
 * models, comma separated.
 */
export function assistantReader(env: Env = process.env): Reader | undefined {
  const apiKey = env.GEMINI_API_KEY?.trim();
  const setting = env.LAITURI_ASSISTANT_ENGINE?.trim().toLowerCase();
  const scripted = env.LAITURI_AGENT_ENGINE?.trim().toLowerCase() === "scripted";
  if (!apiKey || setting === "rules" || (!setting && scripted)) return undefined;
  const listed = env.LAITURI_ASSISTANT_MODEL?.split(",").map((model) => model.trim()).filter(Boolean);
  return budgeted(geminiReader({ apiKey, models: listed?.length ? listed : DEFAULT_ASSISTANT_MODELS }));
}

/** Each reading spends one call from the shared model budget; over budget, the rules read the words. */
export function budgeted(reader: Reader, admit: () => boolean = admitModelCall): Reader {
  return {
    get model() {
      return reader.model;
    },
    read: async (words, context) => (admit() ? reader.read(words, context) : undefined),
  };
}

/**
 * The model's reading over the rules' reading. A model may add a dietary need, never drop one the rules read; a
 * field the model left out keeps the rules' value; a date the rules read wins.
 */
export function mergeReadings(rules: Understanding, model: ModelReading | undefined): Understanding {
  if (!model) return rules;
  return {
    language: model.language,
    intent: rules.intent === "reset" ? "reset" : model.intent,
    guests: model.guests ?? rules.guests,
    // Weekdays and relative days are calendar arithmetic: the rules' date wins when they read one.
    date: rules.date ?? model.date,
    occasion: model.occasion ?? rules.occasion,
    dietary: [...new Set([...rules.dietary, ...model.dietary])],
    noDietaryNeeds: model.noDietaryNeeds ?? rules.noDietaryNeeds,
    courses: model.courses ?? rules.courses,
    budgetPerGuest: model.budgetPerGuest ?? rules.budgetPerGuest,
    // A menu named by its own label ("Klassinen", "the classic") is read by rule; the model resolves the rest.
    choice: rules.choice ?? model.choice,
    recipeQuery: model.recipeQuery ?? rules.recipeQuery,
    opener: model.opener,
  };
}
