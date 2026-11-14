import { describe, expect, it } from "vitest";
import type { Basket } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import { latestAgentStep, recentAgentBasket, stepSentence } from "@/lib/shop-console/agent-watch";

const NOW = Date.parse("2026-11-14T18:00:00Z");
const call = (at: string, patch: Partial<Activity> = {}): Activity => ({
  id: `act_${at}`,
  at,
  agent: { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" },
  kind: "tool",
  tool: "search_catalog",
  title: "Searched the catalogue for 'laktoositon maito'",
  status: "ok",
  ...patch,
});

describe("your agent is shopping", () => {
  it("says the latest step in plain words, with what it searched for", () => {
    const step = latestAgentStep([call("2026-11-14T17:59:00Z"), call("2026-11-14T17:59:30Z", { tool: "request_quote", title: "Quote" })], NOW);
    expect(step?.sentence).toBe("Asked for a fixed price.");
    expect(stepSentence(call("x"))).toEqual({ sentence: "Searched for “laktoositon maito”.", query: "laktoositon maito" });
    expect(stepSentence({ tool: "place_order", title: "", status: "waiting" }).sentence).toBe("Placed an order. It needs you.");
  });

  it("ignores the shop's own searches, demo history and old steps", () => {
    const shop = call("2026-11-14T17:59:50Z", { agent: { id: "agent:anonymous", name: "A person in the shop" } });
    const seeded = call("2026-11-14T17:59:55Z", { seeded: true });
    expect(latestAgentStep([shop, seeded], NOW)).toBeUndefined();
    expect(latestAgentStep([call("2026-11-14T17:50:00Z")], NOW)).toBeUndefined();
  });
});

describe("what your agent ordered", () => {
  const basket = (patch: Partial<Basket>): Basket => ({
    id: "bsk_1",
    title: "Weekly order",
    source: "agent",
    buyer: { id: "b", name: "Nordic Harbour Hotels" },
    deliverBy: "2026-11-16",
    createdAt: "2026-11-14T17:58:00Z",
    status: "done",
    lines: [
      { id: "l1", words: "milk", asked: { amount: 20, unit: "l" }, state: "green", reason: "Ordered.", product: { id: "464306", name: "Milk" } },
      { id: "l2", words: "nuts", asked: { amount: 1, unit: "kg" }, state: "red", reason: "Contains nuts." },
    ],
    totals: { lines: 2, green: 1, orange: 0, red: 1, working: 0, netOrdered: 24, netWaiting: 0, minutesByHand: 2 },
    summary: "1 of 2 lines ordered. 1 is blocked.",
    ...patch,
  });

  it("says how many lines and their states, and which products it picked", () => {
    expect(recentAgentBasket([basket({})], NOW)).toEqual({
      id: "bsk_1",
      sentence: "Your agent ordered 2 lines just now.",
      counts: { green: 1, orange: 0, red: 1, working: 0 },
      productIds: ["464306"],
    });
  });

  it("leaves out a person's own shop order, demo history and old baskets", () => {
    expect(recentAgentBasket([basket({ source: "manual" })], NOW)).toBeUndefined();
    expect(recentAgentBasket([basket({ seeded: true })], NOW)).toBeUndefined();
    expect(recentAgentBasket([basket({ createdAt: "2026-11-14T17:00:00Z" })], NOW)).toBeUndefined();
  });
});
