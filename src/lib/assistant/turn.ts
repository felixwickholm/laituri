import type {
  AssistantAction,
  AssistantAsk,
  AssistantCard,
  AssistantLanguage,
  AssistantTurn,
  AssistantTurnRequest,
  MenuOption,
  MenuPlan,
  MenuPlanRequest,
} from "@/lib/contracts";
import { addDays, helsinkiDate } from "@/lib/agent/dates";
import {
  eventCard,
  ideaCards,
  menuCard,
  menuFor,
  orderAction,
  recipeAction,
  recipeCard,
  recommendedMenu,
  findRecipes,
  shoppingCard,
  basketFor,
} from "./cards";
import { mergeReadings, type ModelContext, type Reader } from "./model";
import * as replies from "./replies";
import { TIER_FI } from "./replies";
import { TIER_LABEL } from "./cards";
import { SAY, spokenDate } from "./replies";
import { readTurn, type Understanding } from "./rules";
import { countTurn, openConversation, saveConversation, type Conversation, type EventSoFar } from "./state";

export interface TurnDeps {
  now: Date;
  /** The menu planner for this buyer, under its mandate in force and with its stock. */
  plan(request: MenuPlanRequest): Promise<MenuPlan>;
  /** Gemini, or none: then the rules read the words. */
  reader?: Reader;
  /** What the kitchen has in stock, in recipe words, for proactive ideas. */
  pantryWords: string[];
}

/** With no date after asking once, the planner's own default: a week ahead. */
const DEFAULT_DAYS_AHEAD = 7;
const RECENT_TURNS = 4;

interface Outcome {
  reply: string;
  asks: AssistantAsk[];
  turnCards: AssistantCard[];
  orderNow?: MenuOption;
}

function hasEvent(event: EventSoFar): boolean {
  return Boolean(event.guests || event.date || event.occasion || event.dietary.length);
}

function modelContext(conversation: Conversation, today: string): ModelContext {
  const plan = conversation.plan;
  return {
    today,
    known: { ...conversation.event, asked: conversation.asked, chosenMenuId: conversation.chosenMenuId },
    menus: (plan?.menus ?? []).map((menu) => ({ tier: menu.tier, label: `${TIER_LABEL[menu.tier]} / ${TIER_FI[menu.tier]}`, name: `${menu.name}: ${menu.courses.map((course) => course.recipe.name).join(", ")}` })),
    recent: conversation.turns.slice(-RECENT_TURNS),
  };
}

/** Folds what this turn said into the event; returns true when anything the planner uses changed. */
function applyEvent(conversation: Conversation, heard: Understanding, hasMenus: boolean): boolean {
  const event = conversation.event;
  const before = JSON.stringify(event);
  if (heard.guests) event.guests = heard.guests;
  if (heard.date) event.date = heard.date;
  if (heard.occasion) event.occasion = heard.occasion;
  if (heard.courses) event.courses = heard.courses;
  if (heard.budgetPerGuest) event.budgetPerGuest = heard.budgetPerGuest;
  if (!hasMenus && (heard.choice === "three_course" || heard.choice === "two_course")) event.courses = heard.choice === "three_course" ? 3 : 2;
  if (heard.dietary.length) {
    event.dietary = [...new Set([...event.dietary, ...heard.dietary])];
    conversation.dietsAnswered = true;
  }
  if (heard.noDietaryNeeds) conversation.dietsAnswered = true;
  return JSON.stringify(event) !== before;
}

function ask(conversation: Conversation, what: AssistantAsk): void {
  if (!conversation.asked.includes(what)) conversation.asked.push(what);
}

function focusMenu(conversation: Conversation): MenuOption | undefined {
  const plan = conversation.plan;
  if (!plan?.menus.length) return undefined;
  return plan.menus.find((menu) => menu.id === conversation.chosenMenuId) ?? recommendedMenu(plan, conversation.event);
}

async function replan(conversation: Conversation, deps: TurnDeps, today: string): Promise<void> {
  const { event } = conversation;
  if (!event.guests) return;
  const previousFocus = focusMenu(conversation);
  const previous =
    previousFocus && conversation.plannedGuests && conversation.plannedGuests !== event.guests
      ? { menuId: previousFocus.id, guests: conversation.plannedGuests }
      : undefined;
  const plan = await deps.plan({
    guests: event.guests,
    date: event.date ?? addDays(today, DEFAULT_DAYS_AHEAD),
    ...(event.occasion ? { occasion: event.occasion } : {}),
    dietary: event.dietary,
    ...(event.budgetPerGuest ? { budgetPerGuest: event.budgetPerGuest } : {}),
    ...(previous ? { previous } : {}),
  });
  conversation.plan = plan;
  conversation.plannedGuests = event.guests;
  if (!plan.menus.some((menu) => menu.id === conversation.chosenMenuId)) conversation.chosenMenuId = undefined;
}

function linesToOrder(plan: MenuPlan, option: MenuOption, today: string): number {
  return basketFor(plan, option, today).lines.length;
}

/** What to say, and the question to ask, once the words are folded in and the plan is fresh. */
function decide(conversation: Conversation, heard: Understanding, guestsBefore: number | undefined, today: string, pantryWords: string[]): Outcome {
  const language = conversation.language;
  const { event, plan } = conversation;
  const say = (text: Record<AssistantLanguage, string>) => text[language];

  if (heard.intent === "human") return { reply: say(SAY.human), asks: [], turnCards: [] };
  if (heard.intent === "thanks" && plan) return { reply: say(SAY.thanks), asks: [], turnCards: [] };

  if (heard.intent === "recipes" || (heard.intent === "ideas" && heard.recipeQuery)) {
    const found = findRecipes(heard.recipeQuery ?? "", conversation.turns.at(-1)?.words ?? "", event.dietary);
    const fromMenu = found.length ? [] : (focusMenu(conversation)?.courses ?? []).map((course) => course.recipe);
    const cards = [...found.map((recipe) => recipeCard(recipe)), ...fromMenu.map((recipe) => recipeCard(recipe, language === "fi" ? "Menussasi" : "In your menu"))];
    return { reply: cards.length ? replies.recipesFound(cards.length, language) : say(SAY.noRecipe), asks: [], turnCards: cards };
  }

  if (heard.intent === "order") {
    if (!plan?.menus.length) return askForEvent(conversation, heard);
    const target = focusMenu(conversation);
    if (!target) return { reply: say(SAY.noMain), asks: [], turnCards: [] };
    const lines = linesToOrder(plan, target, today);
    if (lines === 0) return { reply: say(SAY.nothingToOrder), asks: [], turnCards: [] };
    conversation.chosenMenuId = target.id;
    return { reply: replies.ordering(target, lines, language), asks: [], turnCards: [], orderNow: target };
  }

  if (!plan) {
    if (heard.intent === "ideas" || !hasEvent(event)) {
      const ideas = ideaCards(event, pantryWords);
      const reply = hasEvent(event) || heard.intent === "ideas" ? say(SAY.ideasIntro) : say(SAY.welcome);
      return { reply, asks: [], turnCards: ideas };
    }
    return askForEvent(conversation, heard);
  }

  if (!plan.menus.length) return { reply: say(SAY.noMenus), asks: [], turnCards: [] };

  const focus = focusMenu(conversation);
  // Every menu lacks a main course: none is suggested, and the kitchen hears why.
  if (!focus) return { reply: say(SAY.noMain), asks: [], turnCards: [] };
  if (heard.intent === "choose" && conversation.chosenMenuId) {
    return { reply: replies.chosen(focus, linesToOrder(plan, focus, today), language), asks: [], turnCards: [] };
  }

  const changed = guestsBefore && event.guests && guestsBefore !== event.guests ? `${replies.guestsChanged(guestsBefore, event.guests, language)} ` : "";
  let reply = changed + replies.menusReady(plan.menus.length, event.guests!, plan.event.date, event.dietary, focus, language);
  const asks: AssistantAsk[] = [];
  if (!conversation.dietsAnswered && !conversation.asked.includes("diets")) {
    reply = `${changed}${replies.menusReady(plan.menus.length, event.guests!, plan.event.date, event.dietary, focus, language)} ${say(SAY.askDiets)}`;
    asks.push("diets");
    ask(conversation, "diets");
  }
  return { reply, asks, turnCards: [] };
}

/** Before a plan: the guest count is needed; the date is asked once, then a week ahead is assumed. */
function askForEvent(conversation: Conversation, heard: Understanding): Outcome {
  const language = conversation.language;
  const { event } = conversation;
  const opener = heard.opener ? `${heard.opener} ` : "";
  if (!event.guests && !event.date && !conversation.asked.includes("date")) {
    ask(conversation, "guests");
    ask(conversation, "date");
    return { reply: opener + SAY.askGuestsAndDate[language], asks: ["guests", "date"], turnCards: [] };
  }
  if (!event.guests) {
    ask(conversation, "guests");
    return { reply: opener + SAY.askGuests[language], asks: ["guests"], turnCards: [] };
  }
  ask(conversation, "date");
  return { reply: opener + SAY.askDate[language], asks: ["date"], turnCards: [] };
}

const QUICK: Record<AssistantAsk | "start" | "menus", Record<AssistantLanguage, string[]>> = {
  start: {
    fi: ["Häät lauantaina, 80 vierasta", "Pikkujoulut 40 hengelle", "Mitä tarjoaisin?"],
    en: ["Wedding on Saturday, 80 guests", "Christmas party for 40", "What should we serve?"],
  },
  guests: { fi: ["40 vierasta", "80 vierasta", "120 vierasta"], en: ["40 guests", "80 guests", "120 guests"] },
  date: { fi: ["Huomenna", "Lauantaina", "Ensi perjantaina"], en: ["Tomorrow", "Saturday", "Next Friday"] },
  diets: { fi: ["Ei allergioita", "Gluteeniton", "Laktoositon"], en: ["No allergies", "Gluten-free", "Lactose-free"] },
  choice: { fi: [], en: [] },
  menus: { fi: ["Tilaa se", "Näytä reseptit"], en: ["Order it", "Show the recipes"] },
};

function quickReplies(asks: AssistantAsk[], conversation: Conversation): AssistantAction[] {
  const language = conversation.language;
  const key = asks.find((entry) => entry !== "choice") ?? (conversation.plan?.menus.length ? "menus" : hasEvent(conversation.event) ? undefined : "start");
  if (!key) return [];
  const words = key === "guests" && asks.includes("date") ? [] : QUICK[key][language];
  return words.map((entry) => ({ kind: "reply", label: entry, words: entry }));
}

function snapshot(conversation: Conversation, outcome: Outcome, today: string): { cards: AssistantCard[]; actions: AssistantAction[] } {
  const { plan, event } = conversation;
  const cards: AssistantCard[] = [];
  const actions: AssistantAction[] = [];
  const understood = [
    event.occasion,
    event.guests ? `${event.guests} guests` : undefined,
    event.date ? spokenDate(event.date, "en") : undefined,
    ...event.dietary,
  ].filter(Boolean).join(", ");
  if (hasEvent(event)) cards.push(eventCard(plan, event, understood));
  cards.push(...outcome.turnCards);
  const focus = focusMenu(conversation);
  if (plan?.menus.length && event.guests) {
    const suggested = recommendedMenu(plan, event);
    for (const menu of plan.menus) {
      cards.push(menuCard(menu, plan.event.guests ?? event.guests, { recommended: menu.id === suggested?.id, chosen: menu.id === conversation.chosenMenuId }));
      actions.push(orderAction(plan, menu, today, outcome.orderNow?.id === menu.id));
      actions.push({ kind: "choose_menu", menuId: menu.id, label: menu.name });
    }
    if (focus) {
      cards.push(shoppingCard(plan, focus, today));
      for (const course of focus.courses) actions.push(recipeAction(course.recipe));
    }
  }
  for (const card of outcome.turnCards) if (card.kind === "recipe") actions.push(recipeAction(card));
  return { cards, actions };
}

/**
 * One turn of the event assistant. The words are read by Gemini when configured (structured output, validated) and
 * always by the rules; the model may add a need, never drop one. Menus, prices, allergens and stock come only from
 * the planner and the recipe library. The answer is a short reply, what is still needed, and cards with actions.
 */
export async function assistantTurn(request: AssistantTurnRequest, buyerId: string, deps: TurnDeps): Promise<AssistantTurn> {
  const ms = deps.now.getTime();
  countTurn(ms);
  const today = helsinkiDate(deps.now);
  const conversation = openConversation(request.conversationId, buyerId, request.language ?? "en", ms);
  const hasMenus = Boolean(conversation.plan?.menus.length);

  const byRules = readTurn(request.words, today, request.language ?? conversation.language, hasMenus);
  let engine: AssistantTurn["engine"] = "rules";
  let reading;
  if (deps.reader) {
    reading = await deps.reader.read(request.words, modelContext(conversation, today)).catch(() => undefined);
    if (reading) engine = "gemini";
  }
  const heard = mergeReadings(byRules, reading);
  if (request.menuId && conversation.plan?.menus.some((menu) => menu.id === request.menuId)) {
    heard.intent = heard.intent === "order" ? "order" : "choose";
    conversation.chosenMenuId = request.menuId;
  }
  conversation.language = heard.language;

  if (heard.intent === "reset") {
    Object.assign(conversation, { event: { dietary: [] }, asked: [], dietsAnswered: false, plan: undefined, plannedGuests: undefined, chosenMenuId: undefined });
    heard.intent = heard.guests || heard.date || heard.occasion || heard.dietary.length ? "event" : "other";
  }
  conversation.turns.push({ from: "kitchen", words: request.words });

  const guestsBefore = conversation.plannedGuests;
  const changed = applyEvent(conversation, heard, hasMenus);
  if (hasMenus && heard.choice && !request.menuId) {
    const picked = menuFor(conversation.plan!, heard.choice);
    if (picked) {
      conversation.chosenMenuId = picked.id;
      if (heard.intent !== "order") heard.intent = "choose";
    }
  }
  const ready = Boolean(conversation.event.guests && (conversation.event.date || conversation.asked.includes("date")));
  if (ready && (changed || !conversation.plan)) await replan(conversation, deps, today);

  const outcome = decide(conversation, heard, changed ? guestsBefore : undefined, today, deps.pantryWords);
  const { cards, actions } = snapshot(conversation, outcome, today);
  actions.push(...quickReplies(outcome.asks, conversation));
  conversation.turns.push({ from: "assistant", words: outcome.reply });
  saveConversation(conversation, ms);

  return {
    conversationId: conversation.id,
    language: conversation.language,
    reply: outcome.reply,
    ...(outcome.asks.length ? { asks: outcome.asks } : {}),
    cards,
    actions,
    turns: conversation.turns.slice(-RECENT_TURNS),
    engine,
    ...(engine === "gemini" && deps.reader ? { model: deps.reader.model } : {}),
  };
}
