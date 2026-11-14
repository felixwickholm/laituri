import type { AssistantLanguage, DietaryNeed } from "@/lib/contracts";
import { readEventWords } from "@/lib/menu";

export { readBudget } from "@/lib/menu/parse";

/** What the kitchen wants from this turn. */
export type Intent = "event" | "choose" | "order" | "recipes" | "ideas" | "reset" | "human" | "thanks" | "other";

/** A menu the kitchen picks: by tier, or by its kind. */
export type Choice = "good" | "better" | "best" | "buffet" | "two_course" | "three_course";

/** One turn's words, read. Everything is optional: a turn may only answer one question. */
export interface Understanding {
  language: AssistantLanguage;
  intent: Intent;
  guests?: number;
  date?: string;
  occasion?: string;
  dietary: DietaryNeed[];
  /** "No allergies": the diet question is answered with nothing. */
  noDietaryNeeds?: boolean;
  courses?: number;
  budgetPerGuest?: number;
  choice?: Choice;
  /** English words to look for in the recipes: "salmon", "cake". */
  recipeQuery?: string;
  /** A short warm opener the model may add ("Congratulations!"). Never a fact. */
  opener?: string;
}

const FINNISH_WORDS =
  /\b(?:meillä|meille|on|ja|ei|kyllä|vierasta|vieraita|hengen|henkeä|häät|tilaa|tilataan|lauantaina|sunnuntaina|perjantaina|ensi|viikolla|kiitos|näytä|resepti\p{L}*|ruokalaji\p{L}*|juhla\p{L}*|kuinka|paljon|mitä|alle|euroa|keliaaki\p{L}*|allergi\p{L}*|kaikki|toinen|halvin|paras|ihmisen?)\b/giu;
const ENGLISH_WORDS = /\b(?:we|have|a|the|for|guests|people|on|and|no|yes|order|show|recipe|please|wedding|saturday|friday|next|week|thanks|allergies|courses|what|cheapest|best|with)\b/giu;

/** Finnish when the words look Finnish, English when they look English, else the conversation's language so far. */
export function detectLanguage(words: string, fallback: AssistantLanguage): AssistantLanguage {
  const finnish = (words.match(FINNISH_WORDS)?.length ?? 0) + (/[äöå]/i.test(words) ? 2 : 0);
  const english = words.match(ENGLISH_WORDS)?.length ?? 0;
  if (finnish === english) return fallback;
  return finnish > english ? "fi" : "en";
}

const RESET = /\b(?:start over|new event|reset|aloit\p{L}* alusta|alusta|uusi tapahtuma|uusi juhla)\b/iu;
const ORDER = /\b(?:order (?:it|this|that|the|them|now)|place (?:the |an )?order|let'?s order|go ahead|tilaa|tilataan|tilaan|tilaisin|tilatkaa|tilaathan|laita tilaukseen)\b/iu;
/** Finnish builds compounds ("lohiresepti"), so the Finnish stems match inside a word. */
const RECIPES = /\b(?:recipes?|how (?:do i|to) (?:make|cook))\b|resepti|ruokaohje|miten (?:tehdään|teen|valmistetaan)/iu;
const IDEAS = /\b(?:ideas?|suggest\p{L}*|propose|inspire|season\p{L}*|what (?:should|could) (?:we|i) (?:serve|make|cook)|idea\p{L}*|ehdot\p{L}*|vinkk\p{L}*|sesonki\p{L}*|mitä (?:tarjoaisi\p{L}*|kannattaisi|voisi\p{L}*|tarjo\p{L}*))\b/iu;
/**
 * Asking for a person, as whole phrases: "80 ihmiselle" counts guests, it does not ask for a human.
 * Finnish: "puhua ihmisen kanssa", "haluan ihmisen", "voinko puhua myyjän kanssa", "soittakaa minulle".
 */
const HUMAN =
  /\b(?:(?:talk|speak|chat) (?:to|with) (?:a |an |the )?(?:human|person|real person|someone|somebody|sales ?person|seller)|(?:a |an )?(?:real|actual) (?:human|person)|(?:want|need|get) (?:a |an )?(?:human|person)|ask a (?:human|person)|call me|(?:puhu\p{L}*|jutella) (?:\p{L}+ )?(?:ihmisen|myyjän|henkilön|jonkun) kanssa|halua\p{L}* (?:puhua )?(?:ihmisen|myyjän|oikean ihmisen)|oike\p{L}* ihmi\p{L}*|ihmisen kanssa|myyjä\p{L}*|soita\p{L}*|asiakaspalvel\p{L}*)\b/iu;
const THANKS = /^(?:thanks?|thank you|great|ok|okay|perfect|kiitos|kiitti|selvä|hienoa|hyvä|loistavaa)[.!\s]*$/iu;
const NO_DIET =
  /\b(?:no (?:allergies|special (?:diets?|needs))|nothing special|none|no diets?|ei (?:allergioita|erityis\p{L}*|ole allergio\p{L}*|mitään erityis\p{L}*)|ei mitään|ei ole)\b/iu;

const CHOICES: [RegExp, Choice][] = [
  [/\b(?:three[\s-]course|kolmen ruokalajin|kolme ruokalajia|kolmiruokalaji\p{L}*)\b/iu, "three_course"],
  [/\b(?:two[\s-]course|kahden ruokalajin|kaksi ruokalajia)\b/iu, "two_course"],
  [/\b(?:buffet|seisova\p{L}*|noutopöy\p{L}*)\b/iu, "buffet"],
  [/\b(?:simple|cheapest|good one|first one|the first|halvin|halvemp\p{L}*|edullisin|yksinkertai\p{L}*|ensimmäi\p{L}*)\b/iu, "good"],
  [/\b(?:classic|middle|second|the better|klassi\p{L}*|keskimmäi\p{L}*|toinen|toista)\b/iu, "better"],
  [/\b(?:special|best|fanciest|third|the last|erikois\p{L}*|paras|parasta|kallein|juhlavin|kolmas|kolmatta|viimei\p{L}*)\b/iu, "best"],
];

/** Course-count words name a menu only once menus are on the table; before that they describe the event. */
export function readChoice(words: string): Choice | undefined {
  return CHOICES.find(([pattern]) => pattern.test(words))?.[1];
}

/** English recipe words from a Finnish or English request: "näytä lohiresepti" -> "salmon". */
const QUERY_WORDS: [RegExp, string][] = [
  [/\b(?:lohi\p{L}*|salmon)\b/iu, "salmon"],
  [/\b(?:kakku\p{L}*|täytekak\p{L}*|kermakak\p{L}*|cake)\b/iu, "cake"],
  [/\b(?:bolognese|jauheliha\p{L}*|mince)\b/iu, "bolognese"],
  [/\b(?:keitto\p{L}*|soup)\b/iu, "soup"],
  [/\b(?:kana\p{L}*|chicken)\b/iu, "chicken"],
  [/\b(?:kala\p{L}*|fish)\b/iu, "fish"],
  [/\b(?:jälkiruo\p{L}*|dessert)\b/iu, "dessert"],
  [/\b(?:alkuruo\p{L}*|starter)\b/iu, "starter"],
  [/\b(?:peruna\p{L}*|potato\p{L}*)\b/iu, "potato"],
  [/\b(?:lasagne|lasagnette|lasanje\p{L}*)\b/iu, "lasagne"],
  [/\b(?:kasvis\p{L}*|vegetarian|vegaani\p{L}*|vegan)\b/iu, "vegetable"],
];

function recipeQuery(words: string): string | undefined {
  const found = QUERY_WORDS.filter(([pattern]) => pattern.test(words)).map(([, word]) => word);
  return found.length ? [...new Set(found)].join(" ") : undefined;
}

/**
 * Reads one turn by rule, in English or Finnish. The menu planner's own reader gives guests, date, occasion, diets
 * and courses, so the assistant and the planner understand the same words the same way.
 */
export function readTurn(words: string, today: string, fallback: AssistantLanguage, hasMenus: boolean): Understanding {
  const language = detectLanguage(words, fallback);
  const event = readEventWords(words, today);
  const bare = words.trim().match(/^(\d{1,4})$/);
  const guests = event.guests ?? (bare ? Number(bare[1]) : undefined);
  const budgetPerGuest = event.budgetPerGuest;
  const choice = hasMenus ? readChoice(words) : undefined;
  const noDietaryNeeds = NO_DIET.test(words) && event.dietary.length === 0 ? true : undefined;
  const base = { language, guests, date: event.date, occasion: event.occasion, dietary: event.dietary, courses: event.courses, budgetPerGuest, noDietaryNeeds };
  const describes = Boolean(guests || event.date || event.occasion || event.dietary.length || budgetPerGuest || noDietaryNeeds);

  let intent: Intent = describes ? "event" : "other";
  if (RESET.test(words)) intent = "reset";
  else if (ORDER.test(words)) intent = "order";
  else if (RECIPES.test(words)) intent = "recipes";
  else if (choice && !describes) intent = "choose";
  else if (IDEAS.test(words) && !describes) intent = "ideas";
  else if (HUMAN.test(words)) intent = "human";
  else if (THANKS.test(words.trim())) intent = "thanks";
  else if (choice && hasMenus && !guests) intent = "choose";
  return { ...base, intent, choice, recipeQuery: intent === "recipes" || intent === "ideas" ? recipeQuery(words) : undefined };
}
