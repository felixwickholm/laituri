import { describe, expect, it } from "vitest";
import type { ModelProvider, ModelReply } from "@/lib/agent/llm";
import { modelWordsReader, wordsReaderFor } from "@/lib/menu/model-reader";
import { plan } from "./support";

/** A provider that answers once with the given reply and records what it was asked. Never touches a network. */
function mockProvider(reply: ModelReply): ModelProvider & { asked: { system: string; request: string; tools: string[] }[] } {
  const asked: { system: string; request: string; tools: string[] }[] = [];
  return {
    engine: "claude",
    model: "mock",
    asked,
    open: ({ system, request, tools }) => {
      asked.push({ system, request, tools: tools.map((tool) => tool.name) });
      return { next: async () => reply };
    },
  };
}

const readEvent = (input: unknown): ModelReply => ({ status: "tool_calls", text: "", calls: [{ id: "c1", name: "read_event", input }] });

describe("a model reading the words", () => {
  it("is not used when the scripted engine runs, so tests and evals never call a provider", () => {
    expect(modelWordsReader()).toBeUndefined();
  });

  it("reads the event only, through one tool, and its reading is used when it parses", async () => {
    const provider = mockProvider(readEvent({ guests: 64, date: "2026-11-20", occasion: "gala dinner", dietary: ["vegetarian"] }));
    const result = await plan({ words: "Gala for sixty-four on Friday, veggie please" }, "nordicHarbour", { readWords: wordsReaderFor(provider) });
    expect(provider.asked[0].tools).toEqual(["read_event"]);
    expect(provider.asked[0].system).toContain("Do not suggest dishes.");
    expect(result.event).toEqual({ guests: 64, date: "2026-11-20", occasion: "dinner", dietary: ["vegetarian"] });
    expect(result.notes[0]).toBe("A model read your words. Dishes and prices come from rules.");
  });

  it("can add a dietary need but never drop one the rules read", async () => {
    const provider = mockProvider(readEvent({ guests: 80, dietary: [] }));
    const result = await plan({ words: "Dinner for 80 on Friday, no nuts" }, "nordicHarbour", { readWords: wordsReaderFor(provider) });
    expect(result.event.dietary).toEqual(["nut_free"]);
  });

  it.each([
    ["an answer that does not parse", readEvent({ guests: "eighty", dietary: ["no_lobster"] })],
    ["a plain text answer", { status: "final", text: "80 guests." } as ModelReply],
    ["a refusal", { status: "refused", detail: "No." } as ModelReply],
  ])("falls back to the rules on %s", async (_label, reply) => {
    const result = await plan({ words: "Dinner for 80 on Friday, no nuts" }, "nordicHarbour", { readWords: wordsReaderFor(mockProvider(reply)) });
    expect(result.event).toEqual({ guests: 80, date: "2026-11-20", occasion: "dinner", dietary: ["nut_free"] });
    expect(result.notes[0]).not.toMatch(/model/);
  });
});
