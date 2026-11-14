import "../store/temp-data-dir";
import { describe, expect, it } from "vitest";
import { DEFAULT_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL, activeEngine, providerFor, runBuyerAgent, selectEngine } from "@/lib/agent/llm";
import { createGateway } from "@/lib/gateway";
import type { AgentTransport } from "@/lib/agent";
import { AGENT, makeDeps } from "../support/deps";

const BOTH = { ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" };

describe("selectEngine", () => {
  it("prefers Claude, then Gemini, then the scripted agent", () => {
    expect(selectEngine(BOTH)).toEqual({ engine: "claude", model: DEFAULT_CLAUDE_MODEL });
    expect(selectEngine({ GEMINI_API_KEY: "g" })).toEqual({ engine: "gemini", model: DEFAULT_GEMINI_MODEL });
    expect(selectEngine({})).toEqual({ engine: "scripted" });
  });

  it("follows LAITURI_AGENT_ENGINE and the model overrides", () => {
    expect(selectEngine({ ...BOTH, LAITURI_AGENT_ENGINE: "gemini", LAITURI_GEMINI_MODEL: "gemini-x" })).toEqual({ engine: "gemini", model: "gemini-x" });
    expect(selectEngine({ ...BOTH, LAITURI_AGENT_ENGINE: "scripted" })).toEqual({ engine: "scripted" });
    expect(selectEngine({ ...BOTH, LAITURI_CLAUDE_MODEL: "claude-x" }).model).toBe("claude-x");
  });

  it("says why a requested engine cannot run", () => {
    expect(selectEngine({ LAITURI_AGENT_ENGINE: "claude", GEMINI_API_KEY: "g" })).toEqual({
      engine: "scripted",
      unavailable: "ANTHROPIC_API_KEY is not set.",
    });
    expect(selectEngine({ LAITURI_AGENT_ENGINE: "gpt" }).unavailable).toMatch(/is not one of auto, claude, gemini, scripted/);
  });

  it("builds a provider only for a model engine", () => {
    expect(providerFor(selectEngine(BOTH), BOTH)?.engine).toBe("claude");
    expect(providerFor({ engine: "scripted" }, BOTH)).toBeUndefined();
  });

  it("reports the active engine for health without the reason", () => {
    expect(activeEngine({ LAITURI_AGENT_ENGINE: "claude" })).toEqual({ engine: "scripted" });
    expect(activeEngine({ GEMINI_API_KEY: "g" })).toEqual({ engine: "gemini", model: DEFAULT_GEMINI_MODEL });
  });
});

describe("runBuyerAgent", () => {
  it("runs the scripted agent and says so when the requested model has no key", async () => {
    const gateway = createGateway(makeDeps().deps);
    const transport: AgentTransport = {
      searchCatalog: (request) => gateway.searchCatalog(AGENT, request),
      getProduct: (id) => gateway.getProduct(AGENT, id),
      requestQuote: (request) => gateway.requestQuote(AGENT, request),
      getMandate: () => gateway.getMandate(),
      placeOrder: (request) => gateway.placeOrder(AGENT, request),
      getOrder: (id) => gateway.getOrder(AGENT, id),
    };
    const notes: string[] = [];
    const hooks = { note: (text: string) => void notes.push(text), pause: async () => undefined };
    const result = await runBuyerAgent("100 litres of Eila by Monday", transport, hooks, selectEngine({ LAITURI_AGENT_ENGINE: "gemini" }));

    expect(notes[0]).toBe("The model agent is not available: GEMINI_API_KEY is not set. The scripted agent runs this request.");
    expect(result.steps[0].text).toBe(notes[0]);
    expect(result.status).toBe("confirmed");
  });
});
