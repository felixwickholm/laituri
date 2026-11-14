import "../store/temp-data-dir";
import { describe, expect, it } from "vitest";
import type { AgentTransport } from "@/lib/agent";
import type { PlaceOrderRequest } from "@/lib/contracts";
import { ProviderError, runModelPurchase, type ModelProvider, type ModelReply, type ToolOutcome } from "@/lib/agent/llm";
import { createGateway } from "@/lib/gateway";
import { AGENT, makeDeps } from "../support/deps";

const REQUEST = "100 litres of Eila by Monday";
const hooks = { note: () => undefined, pause: async () => undefined };

interface Spy {
  transport: AgentTransport;
  orders: PlaceOrderRequest[];
  quoteJws: string[];
  mandateJws: string[];
  searches: number;
}

function spyTransport(): Spy {
  const gateway = createGateway(makeDeps().deps);
  const spy: Omit<Spy, "transport"> = { orders: [], quoteJws: [], mandateJws: [], searches: 0 };
  const transport: AgentTransport = {
    searchCatalog: (request) => {
      spy.searches++;
      return gateway.searchCatalog(AGENT, request);
    },
    getProduct: (id) => gateway.getProduct(AGENT, id),
    requestQuote: async (request) => {
      const quote = await gateway.requestQuote(AGENT, request);
      spy.quoteJws.push(quote.primary.jws, ...quote.alternatives.map((alternative) => alternative.signed.jws));
      return quote;
    },
    getMandate: async () => {
      const signed = await gateway.getMandate();
      spy.mandateJws.push(signed.jws);
      return signed;
    },
    placeOrder: (request) => {
      spy.orders.push(request);
      return gateway.placeOrder(AGENT, request);
    },
    getOrder: (id) => gateway.getOrder(AGENT, id),
  };
  return Object.assign(spy, { transport });
}

type Turn = (results: ToolOutcome[], signal: AbortSignal) => ModelReply | Promise<ModelReply>;

/** A provider that plays fixed turns and records the tool results it was sent. */
function fakeProvider(turns: Turn[]): { provider: ModelProvider; seen: ToolOutcome[][] } {
  const seen: ToolOutcome[][] = [];
  const provider: ModelProvider = {
    engine: "claude",
    model: "test-model",
    open: () => ({
      async next(results, signal) {
        seen.push(results);
        const turn = turns[Math.min(seen.length - 1, turns.length - 1)];
        return turn(results, signal);
      },
    }),
  };
  return { provider, seen };
}

const call = (name: string, input: unknown, text = ""): ModelReply => ({ status: "tool_calls", text, calls: [{ id: `${name}-1`, name, input }] });
const offerIdIn = (results: ToolOutcome[]) => /Primary offer (\S+):/.exec(results[0].content)?.[1] ?? "";

describe("runModelPurchase", () => {
  it("places one order and passes the signed offer and mandate through unchanged", async () => {
    const spy = spyTransport();
    const { provider, seen } = fakeProvider([
      () => call("search_catalog", { query: "Eila", need: { amount: 100, unit: "l" }, deliverBy: "2026-11-16" }, "Searching for Eila."),
      () => call("request_quote", { lines: [{ productId: "464306", quantity: { amount: 100, unit: "l" } }], deliverBy: "2026-11-16" }),
      (results) => call("place_order", { offerId: offerIdIn(results) }, "Ordering the primary offer."),
    ]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider);

    expect(result.status).toBe("confirmed");
    expect(spy.orders).toHaveLength(1);
    expect(spy.orders[0].offerJws).toBe(spy.quoteJws[0]);
    expect(spy.orders[0].mandateJws).toBe(spy.mandateJws.at(-1));
    expect(result.steps.map((step) => step.text)).toEqual(
      expect.arrayContaining(["Searching for Eila.", "Ordering the primary offer.", "Inside my mandate. Order placed."]),
    );
    const everythingTheModelSaw = seen.flat().map((outcome) => outcome.content).join("\n");
    for (const jws of [...spy.quoteJws, ...spy.mandateJws]) expect(everythingTheModelSaw).not.toContain(jws);
  });

  it("feeds a tool error back to the model", async () => {
    const spy = spyTransport();
    const transport: AgentTransport = {
      ...spy.transport,
      requestQuote: async () => {
        throw new Error("The wholesaler did not answer.");
      },
    };
    const { provider, seen } = fakeProvider([
      () => call("request_quote", { lines: [{ productId: "464306", quantity: { amount: 10, unit: "l" } }], deliverBy: "2026-11-16" }),
      () => call("end_without_order", { reason: "The wholesaler is not answering." }),
    ]);
    const result = await runModelPurchase(REQUEST, transport, hooks, provider);

    expect(seen[1][0]).toMatchObject({ name: "request_quote", isError: true, content: "The wholesaler did not answer." });
    expect(result.status).toBe("not_found");
    expect(result.summary).toBe("The wholesaler is not answering. No order placed.");
    expect(spy.orders).toHaveLength(0);
  });

  it("rejects malformed tool arguments before calling the wholesaler", async () => {
    const spy = spyTransport();
    const { provider, seen } = fakeProvider([
      () => call("search_catalog", { query: 42 }),
      () => call("ask_buyer", { question: "Which milk do you mean?" }),
    ]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider);

    expect(seen[1][0].isError).toBe(true);
    expect(seen[1][0].content).toMatch(/^Invalid arguments\. query:/);
    expect(spy.searches).toBe(0);
    expect(result).toMatchObject({ status: "needs_input", summary: "Which milk do you mean?" });
  });

  it("refuses an offer id the wholesaler never issued", async () => {
    const spy = spyTransport();
    const { provider, seen } = fakeProvider([
      () => call("place_order", { offerId: "off_invented" }),
      () => ({ status: "final", text: "How many litres do you need?" }),
    ]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider);

    expect(seen[1][0]).toMatchObject({ isError: true, content: expect.stringContaining("There is no offer off_invented") });
    expect(spy.orders).toHaveLength(0);
    expect(result.status).toBe("needs_input");
  });

  it("stops after the round limit and lets the scripted agent finish", async () => {
    const spy = spyTransport();
    const { provider, seen } = fakeProvider([() => call("search_catalog", { query: "Eila" })]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider, { maxRounds: 3 });

    expect(seen).toHaveLength(3);
    expect(result.steps.map((step) => step.text)).toContain(
      "The Claude agent stopped: it did not finish within 3 rounds. The scripted agent takes over.",
    );
    expect(result.status).toBe("confirmed");
    expect(spy.orders).toHaveLength(1);
  });

  it("falls back to the scripted agent when the provider fails", async () => {
    const spy = spyTransport();
    const { provider } = fakeProvider([
      () => {
        throw new ProviderError("Claude answered with status 529.");
      },
    ]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider);

    expect(result.steps[0]).toEqual({
      text: "The Claude agent stopped: Claude answered with status 529. The scripted agent takes over.",
      status: "error",
    });
    expect(result.status).toBe("confirmed");
  });

  it("falls back when the model declines", async () => {
    const spy = spyTransport();
    const { provider } = fakeProvider([() => ({ status: "refused", detail: "Blocked." })]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider);

    expect(result.steps[0].text).toBe("The Claude agent stopped: it declined the request. Blocked. The scripted agent takes over.");
    expect(result.status).toBe("confirmed");
  });

  it("falls back when the run times out", async () => {
    const spy = spyTransport();
    const { provider } = fakeProvider([
      (_results, signal) =>
        new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new ProviderError("the request was cancelled.")))),
    ]);
    const result = await runModelPurchase(REQUEST, spy.transport, hooks, provider, { timeoutMs: 20 });

    expect(result.steps[0].text).toBe("The Claude agent stopped: it ran out of time. The scripted agent takes over.");
    expect(result.status).toBe("confirmed");
  });
});
