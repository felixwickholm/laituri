import { randomUUID } from "node:crypto";
import type { AssistantAsk, AssistantLanguage, AssistantTurnLine, DietaryNeed, MenuPlan } from "@/lib/contracts";
import { GatewayError } from "@/lib/gateway/errors";
import { workspaceState } from "@/lib/workspace/context";

/** What the assistant knows about one kitchen's event. */
export interface EventSoFar {
  guests?: number;
  date?: string;
  occasion?: string;
  dietary: DietaryNeed[];
  courses?: number;
  budgetPerGuest?: number;
}

export interface Conversation {
  id: string;
  buyerId: string;
  language: AssistantLanguage;
  event: EventSoFar;
  /** Questions already asked once: the assistant does not ask the same thing twice. */
  asked: AssistantAsk[];
  dietsAnswered: boolean;
  plan?: MenuPlan;
  /** The guest count the plan was made for, to show what changes when it moves. */
  plannedGuests?: number;
  chosenMenuId?: string;
  turns: AssistantTurnLine[];
  updatedAt: number;
}

/** Bounds per workspace: a sandbox is one visitor, so a few open conversations are plenty. */
export const MAX_CONVERSATIONS = 24;
export const MAX_TURNS = 8;
const IDLE_MS = 2 * 60 * 60_000;

const conversations = workspaceState("assistant.conversations", () => new Map<string, Conversation>());

export function newConversation(buyerId: string, language: AssistantLanguage, now: number): Conversation {
  return { id: `conv_${randomUUID().slice(0, 12)}`, buyerId, language, event: { dietary: [] }, asked: [], dietsAnswered: false, turns: [], updatedAt: now };
}

/** The conversation by id for this buyer, or a new one. An unknown or idle id starts afresh rather than failing. */
export function openConversation(id: string | undefined, buyerId: string, language: AssistantLanguage, now: number): Conversation {
  const all = conversations();
  const found = id ? all.get(id) : undefined;
  if (found && found.buyerId === buyerId && now - found.updatedAt < IDLE_MS) return found;
  return newConversation(buyerId, language, now);
}

export function saveConversation(conversation: Conversation, now: number): void {
  const all = conversations();
  conversation.updatedAt = now;
  conversation.turns = conversation.turns.slice(-MAX_TURNS);
  all.delete(conversation.id);
  all.set(conversation.id, conversation);
  for (const [id, entry] of all) {
    if (all.size <= MAX_CONVERSATIONS && now - entry.updatedAt < IDLE_MS) break;
    all.delete(id);
  }
}

export class TooManyTurnsError extends GatewayError {
  constructor() {
    super("Too many messages in a short time. Wait a minute and try again.", 429, "rate_limited");
  }
}

/** Turns per workspace in a sliding window: a sandbox is one visitor, and each turn may call a paid model. */
export const TURNS_PER_WINDOW = 40;
export const WINDOW_MS = 10 * 60_000;

const recentTurns = workspaceState("assistant.rate", () => ({ at: [] as number[] }));

/** Counts a turn, or throws 429 when this workspace has used its window. */
export function countTurn(now: number, limit = TURNS_PER_WINDOW): void {
  const window = recentTurns();
  window.at = window.at.filter((at) => now - at < WINDOW_MS);
  if (window.at.length >= limit) throw new TooManyTurnsError();
  window.at.push(now);
}
