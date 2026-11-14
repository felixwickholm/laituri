import { describe, expect, it } from "vitest";
import { TILES } from "@/lib/connect/apps";
import { latestCalls, mergeCalls, timeAgo, type CallRecord } from "@/lib/connect/activity";
import {
  claudeCodeCommand,
  curlOrder,
  curlQuote,
  curlSearch,
  cursorConfig,
  geminiConfig,
  guideFor,
  isLocalOrigin,
  mcpUrlWithKey,
  oneLineCommand,
  vscodeConfig,
} from "@/lib/connect/guides";
import { PROMPT, nextMonday } from "@/lib/connect/requests";
import { flowRequest, previewBody, readStep } from "@/lib/connect/test-flow";
import { TOOL_COPY } from "@/lib/connect/tools";
import { TOOLS } from "@/lib/mcp/tools";
import { PlaceOrderRequest, QuoteRequest, SearchRequest } from "@/lib/contracts";

const ORIGIN = "https://laituri.example";
const MONDAY = "2026-11-16";
/** A sandbox key: random, so every visitor's commands reach only their own workspace. */
const KEY = "lsk_Q7mxA1b2C3d4E5f6G7h8I9j0K1l2M3n4";

describe("MCP setup lines", () => {
  it("builds the Claude Code command with the visitor's key in the bearer header", () => {
    expect(claudeCodeCommand(ORIGIN, KEY)).toBe(
      `claude mcp add --transport http laituri https://laituri.example/mcp --header "Authorization: Bearer ${KEY}"`,
    );
  });

  it("puts the key in the address for chat apps and the landing page's one line", () => {
    expect(mcpUrlWithKey(ORIGIN, KEY)).toBe(`https://laituri.example/mcp?key=${KEY}`);
    expect(mcpUrlWithKey(ORIGIN, "a b&c")).toBe("https://laituri.example/mcp?key=a%20b%26c");
    expect(oneLineCommand(ORIGIN, KEY)).toBe(`claude mcp add --transport http laituri https://laituri.example/mcp?key=${KEY}`);
  });

  it("writes each editor's config in its own shape", () => {
    const headers = { Authorization: `Bearer ${KEY}` };
    expect(JSON.parse(cursorConfig(ORIGIN, KEY))).toEqual({ mcpServers: { laituri: { url: `${ORIGIN}/mcp`, headers } } });
    expect(JSON.parse(vscodeConfig(ORIGIN, KEY))).toEqual({ servers: { laituri: { type: "http", url: `${ORIGIN}/mcp`, headers } } });
    expect(JSON.parse(geminiConfig(ORIGIN, KEY))).toEqual({ mcpServers: { laituri: { httpUrl: `${ORIGIN}/mcp`, headers } } });
  });

  it("gives every app numbered steps with something to copy, and ends agent apps with the prompt", () => {
    for (const tile of TILES) {
      for (const { id } of tile.guides) {
        const { steps } = guideFor(id, ORIGIN, KEY, MONDAY);
        expect(steps.length).toBeGreaterThanOrEqual(3);
        expect(steps.some((step) => step.code)).toBe(true);
        if (id !== "http") expect(steps.at(-1)?.code?.value).toBe(PROMPT);
      }
    }
  });

  it("carries the given key, and never the shared one, in everything an app copies", () => {
    for (const tile of TILES) {
      for (const { id } of tile.guides) {
        const copied = guideFor(id, ORIGIN, KEY, MONDAY).steps.flatMap((step) => (step.code && step.code.value !== PROMPT ? [step.code.value] : []));
        expect(copied.length).toBeGreaterThan(0);
        expect(copied.every((value) => value.includes(KEY))).toBe(true);
        expect(copied.some((value) => value.includes("demo-agent-token"))).toBe(false);
      }
    }
  });

  it("warns only chat connectors about a local address", () => {
    expect(guideFor("claude", "http://localhost:3210", KEY, MONDAY).localNote).toBeDefined();
    expect(guideFor("claude", ORIGIN, KEY, MONDAY).localNote).toBeUndefined();
    expect(guideFor("claude-code", "http://localhost:3210", KEY, MONDAY).localNote).toBeUndefined();
    expect(isLocalOrigin("http://127.0.0.1:3000")).toBe(true);
  });
});

describe("curl flow", () => {
  const body = (command: string) => JSON.parse(command.match(/-d '(.+)'/)![1]);

  it("sends bodies the API accepts", () => {
    expect(SearchRequest.safeParse(body(curlSearch(ORIGIN, KEY, MONDAY))).success).toBe(true);
    expect(QuoteRequest.safeParse(body(curlQuote(ORIGIN, KEY, MONDAY))).success).toBe(true);
  });

  it("keeps the offer and mandate in shell variables and orders with a fresh key", () => {
    expect(curlQuote(ORIGIN, KEY, MONDAY)).toMatch(/^OFFER=\$\(curl -s https:\/\/laituri\.example\/api\/v1\/quotes [\s\S]*\| jq -r \.primary\.jws\)$/);
    const order = curlOrder(ORIGIN, KEY);
    expect(order).toContain("MANDATE=$(curl -s https://laituri.example/api/v1/mandate");
    expect(order).toContain('-H "Idempotency-Key: milk-$(date +%s)"');
    expect(order).toContain('-d "{\\"offerJws\\":\\"$OFFER\\",\\"mandateJws\\":\\"$MANDATE\\"}"');
  });
});

describe("next Monday", () => {
  it("is the first Monday after today in Helsinki", () => {
    expect(nextMonday(new Date("2026-11-14T09:00:00+02:00"))).toBe("2026-11-16");
    expect(nextMonday(new Date("2026-11-16T09:00:00+02:00"))).toBe("2026-11-23");
    expect(nextMonday(new Date("2026-11-15T23:30:00+02:00"))).toBe("2026-11-16");
    expect(nextMonday(new Date("2026-11-15T22:30:00Z"))).toBe("2026-11-23");
  });
});

describe("tool table", () => {
  it("has plain words for every tool the server lists", () => {
    for (const tool of TOOLS) expect(TOOL_COPY[tool.name], tool.name).toBeDefined();
  });

  it("asks for the agent key only where an order is placed", () => {
    expect(Object.entries(TOOL_COPY).filter(([, copy]) => copy.needs === "agent key").map(([name]) => name)).toEqual(["place_order", "place_basket"]);
  });
});

describe("browser test flow", () => {
  const state = { key: KEY, deliverBy: MONDAY, idempotencyKey: "connect-test-0001", offerJws: "a.b.c", mandateJws: "d.e.f" };

  it("sends the documented requests with the visitor's key", () => {
    expect(flowRequest("search", state)).toMatchObject({ method: "POST", path: "/api/v1/products/search", headers: { Authorization: `Bearer ${KEY}` } });
    expect(flowRequest("mandate", state)).toEqual({ method: "GET", path: "/api/v1/mandate", headers: { Authorization: `Bearer ${KEY}` } });
    const order = flowRequest("order", state);
    expect(order.headers["Idempotency-Key"]).toBe("connect-test-0001");
    expect(PlaceOrderRequest.omit({ idempotencyKey: true }).safeParse(order.body).success).toBe(true);
  });

  it("buys a small quantity, so repeated tests stay inside the demo buyer's weekly limit", () => {
    expect(flowRequest("quote", state).body).toMatchObject({ lines: [{ quantity: { amount: 20, unit: "l" } }], intent: "20 litres of lactose-free milk by Monday" });
    expect(flowRequest("search", state).body).toMatchObject({ need: { amount: 20, unit: "l" } });
    expect(curlQuote("https://x.test", KEY, MONDAY)).toContain('"amount":1000');
  });

  it("shortens only the signatures in the terminal preview", () => {
    const shown = previewBody({ offerJws: "eyJhbGciOiJFUzI1NiIsImtpZCI6Ij.payload.signature", intent: "1,000 litres of lactose-free milk by Monday" });
    expect(shown).toBe('{"offerJws":"eyJhbGciOiJFUzI1…","intent":"1,000 litres of lactose-free milk by Monday"}');
    expect(previewBody(undefined)).toBeUndefined();
  });

  it("carries the signatures forward and reads outcomes in plain words", () => {
    expect(readStep("quote", 200, { primary: { jws: "x.y.z", offer: { totals: { net: { amount: 1010 } } } } })).toEqual({
      ok: true,
      tone: "ok",
      summary: "Signed offer, 1,010.00 EUR net, valid 15 minutes.",
      carry: { offerJws: "x.y.z" },
    });
    expect(readStep("search", 400, { detail: "Bad query." })).toEqual({ ok: false, tone: "error", summary: "Bad query." });
  });

  it("ends well on a confirmed order and on one waiting for a person, and stops on a blocked one", () => {
    expect(readStep("order", 201, { id: "ord_1", status: "confirmed" })).toMatchObject({ ok: true, tone: "ok" });
    expect(readStep("order", 202, { id: "ord_1", status: "pending_approval" })).toMatchObject({ ok: true, tone: "waiting" });
    expect(readStep("order", 422, { code: "order_blocked", order: { id: "ord_1", status: "blocked", decision: { checks: [] } } })).toMatchObject({
      ok: false,
      tone: "blocked",
    });
  });

  it("shows a quote refusal's own sentence, not a generic failure", () => {
    const refused = { code: "quantity_implausible", status: 422, detail: "200,000 l of one product is more than one order line may ask for." };
    expect(readStep("quote", 422, refused)).toEqual({ ok: false, tone: "error", summary: refused.detail });
  });
});

describe("live calls", () => {
  const call = (id: string, at: string, extra: Partial<CallRecord> = {}): CallRecord => ({
    id,
    at,
    agent: { id: "agent:x", name: "X" },
    kind: "tool",
    tool: "search_catalog",
    title: "Searched",
    status: "ok",
    ...extra,
  });

  it("shows outside tool calls newest first, without scripted runs or notes", () => {
    const records = [
      call("a", "2026-11-14T08:00:00Z"),
      call("b", "2026-11-14T08:01:00Z", { run: { id: "r", title: "Scene" } }),
      call("c", "2026-11-14T08:02:00Z", { kind: "note" }),
      call("d", "2026-11-14T08:03:00Z"),
    ];
    expect(latestCalls(records, 5).map((record) => record.id)).toEqual(["d", "a"]);
  });

  it("merges a poll without duplicates and keeps the limit", () => {
    const shown = [call("a", "2026-11-14T08:00:00Z")];
    const merged = mergeCalls(shown, [call("a", "2026-11-14T08:00:00Z"), call("e", "2026-11-14T08:05:00Z")], 1);
    expect(merged.map((record) => record.id)).toEqual(["e"]);
  });

  it("says how long ago in short words", () => {
    const now = Date.parse("2026-11-14T08:10:00Z");
    expect(timeAgo("2026-11-14T08:09:58Z", now)).toBe("just now");
    expect(timeAgo("2026-11-14T08:09:30Z", now)).toBe("30 s ago");
    expect(timeAgo("2026-11-14T08:00:00Z", now)).toBe("10 min ago");
  });
});
