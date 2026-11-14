import { z } from "zod";
import { DietaryNeed, IsoDate } from "@/lib/contracts";
import { isValidDate } from "@/lib/agent/dates";
import { admitModelCall, providerFor, selectEngine, type ModelProvider, type ToolSpec } from "@/lib/agent/llm";
import type { WordsReader } from "./event";
import type { ReadEvent } from "./parse";

const READ_TIMEOUT_MS = 8_000;

/** The only thing a model may return: the event as the words state it. It never names dishes, prices or allergens. */
const ModelEvent = z.object({
  guests: z.number().int().min(1).max(2000).optional().describe("How many people eat"),
  date: IsoDate.optional().describe("The event date, YYYY-MM-DD"),
  occasion: z.string().max(40).optional().describe("One or two words, for example wedding, dinner, lunch, buffet"),
  dietary: z.array(DietaryNeed).describe("Needs the words state; empty when none"),
  courses: z.number().int().min(1).max(6).optional().describe("Courses asked for, when stated"),
});

const TOOL_NAME = "read_event";

function readTool(): ToolSpec {
  const parameters = { ...(z.toJSONSchema(ModelEvent, { io: "input" }) as Record<string, unknown>) };
  delete parameters.$schema;
  return { name: TOOL_NAME, description: "Record the event exactly as the words state it.", parameters };
}

function system(today: string): string {
  return [
    `Today is ${today} in Finland. A professional kitchen describes an event in English or Finnish.`,
    `Call ${TOOL_NAME} once with what the words state: guests, date, occasion, dietary needs, courses.`,
    "Leave out anything the words do not state. Do not suggest dishes.",
  ].join(" ");
}

/** Asks the model once and keeps its answer only when it parses; anything else falls back to the rules. */
export function wordsReaderFor(provider: ModelProvider): WordsReader {
  return async (words, today) => {
    const conversation = provider.open({ system: system(today), request: words, tools: [readTool()] });
    const reply = await conversation.next([], AbortSignal.timeout(READ_TIMEOUT_MS));
    if (reply.status !== "tool_calls") return undefined;
    const call = reply.calls.find((entry) => entry.name === TOOL_NAME);
    const parsed = ModelEvent.safeParse(call?.input);
    if (!parsed.success) return undefined;
    const event: ReadEvent = parsed.data;
    return event.date && !isValidDate(event.date) ? { ...event, date: undefined } : event;
  };
}

/**
 * The reader for the configured model engine; none when the scripted engine runs, so the rules read the words. Each
 * reading spends one call from the shared model budget; over budget, the rules read the words.
 */
export function modelWordsReader(): WordsReader | undefined {
  const provider = providerFor(selectEngine());
  if (!provider) return undefined;
  const read = wordsReaderFor(provider);
  return async (words, today) => (admitModelCall() ? read(words, today) : undefined);
}
