import { describe, expect, it, vi } from "vitest";
import { assistantReader, cleanReading, detectLanguage, geminiReader, readBudget, readTurn } from "@/lib/assistant";
import { budgeted } from "@/lib/assistant/model";

const context = { today: "2026-11-14", known: { dietary: [] }, menus: [], recent: [] };

function answer(json: unknown): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), {
    headers: { "content-type": "application/json" },
  });
}

describe("Gemini reader", () => {
  it("sends structured output and the key only in a header", async () => {
    const fetch = vi.fn(async () => answer({ language: "fi", intent: "event", guests: 80, dietary: ["gluten_free"] }));
    const reader = geminiReader({ apiKey: "test-key", models: ["model-a"], fetch: fetch as unknown as typeof globalThis.fetch });
    const reading = await reader.read("Häät, 80 vierasta", context);
    expect(reading).toMatchObject({ guests: 80, dietary: ["gluten_free"] });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.properties.intent).toBeDefined();
  });

  it("moves to the next model when one is out of quota, and rests it", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("model-a") ? new Response("{}", { status: 429 }) : answer({ language: "en", intent: "order", dietary: [] }),
    );
    const reader = geminiReader({ apiKey: "k", models: ["model-a", "model-b"], fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await reader.read("order it", context)).toMatchObject({ intent: "order" });
    expect(reader.model).toBe("model-b");
    await reader.read("order it", context);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("model-a"))).toHaveLength(1);
  });

  it("drops what does not parse, a past date and an opener with numbers", () => {
    expect(cleanReading({ intent: "event" }, "2026-11-14")).toBeUndefined();
    const reading = cleanReading({ language: "en", intent: "event", dietary: [], date: "2026-11-01", opener: "Only €5 a head!" }, "2026-11-14");
    expect(reading?.date).toBeUndefined();
    expect(reading?.opener).toBeUndefined();
  });

  it("drops an opener that states a diet, an allergen or safety, in English or Finnish", () => {
    const opener = (text: string) => cleanReading({ language: "en", intent: "event", dietary: [], opener: text }, "2026-11-14")?.opener;
    for (const text of ["All gluten-free and safe!", "Totally nut free, enjoy!", "Kaikki gluteenitonta!", "Laktoositon juhla!", "Vegan feast ahead!", "Allergy-friendly party!"]) {
      expect(opener(text)).toBeUndefined();
    }
    expect(opener("Onnea hääpäivään!")).toBe("Onnea hääpäivään!");
    expect(opener("Congratulations!")).toBe("Congratulations!");
  });

  it("asks the shared model budget before every reading; over budget the rules read the words", async () => {
    const read = vi.fn(async () => ({ language: "en" as const, intent: "event" as const, dietary: [] }));
    const reader = budgeted({ model: "m", read }, () => false);
    expect(await reader.read("a wedding", context)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
    expect(await budgeted({ model: "m", read }, () => true).read("a wedding", context)).toMatchObject({ intent: "event" });
  });

  it("is off without a key and under the scripted test engine", () => {
    expect(assistantReader({})).toBeUndefined();
    expect(assistantReader({ GEMINI_API_KEY: "k", LAITURI_AGENT_ENGINE: "scripted" })).toBeUndefined();
    expect(assistantReader({ GEMINI_API_KEY: "k", LAITURI_ASSISTANT_ENGINE: "rules" })).toBeUndefined();
    expect(assistantReader({ GEMINI_API_KEY: "k", LAITURI_ASSISTANT_MODEL: "m1, m2" })?.model).toBe("m1");
  });
});

describe("rules", () => {
  it("tells Finnish from English", () => {
    expect(detectLanguage("Meillä on häät lauantaina", "en")).toBe("fi");
    expect(detectLanguage("We have a wedding on Saturday", "fi")).toBe("en");
    expect(detectLanguage("80", "fi")).toBe("fi");
  });

  it("reads budgets and intents in both languages", () => {
    expect(readBudget("alle 15 euroa hengeltä")).toBe(15);
    expect(readBudget("budget 18 € per guest")).toBe(18);
    expect(readTurn("Tilaa se", "2026-11-14", "fi", true).intent).toBe("order");
    expect(readTurn("Klassinen", "2026-11-14", "fi", true)).toMatchObject({ intent: "choose", choice: "better" });
    expect(readTurn("Aloitetaan alusta", "2026-11-14", "fi", true).intent).toBe("reset");
    expect(readTurn("Näytä lohiresepti", "2026-11-14", "fi", false)).toMatchObject({ intent: "recipes", recipeQuery: "salmon" });
    expect(readTurn("Ei allergioita", "2026-11-14", "fi", true).noDietaryNeeds).toBe(true);
  });
});
