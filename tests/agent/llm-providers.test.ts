import { describe, expect, it } from "vitest";
import { ProviderError, claudeProvider, geminiProvider, type ToolSpec } from "@/lib/agent/llm";

const TOOLS: ToolSpec[] = [
  { name: "search_catalog", description: "Search.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
];
const START = { system: "You buy milk.", request: "Milk, please.", tools: TOOLS };
const signal = new AbortController().signal;

interface Sent {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** A fetch that answers from a list and records each request. */
function fakeFetch(answers: Array<{ status?: number; body: unknown }>): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    sent.push({ url: request.url, headers: request.headers, body: (await request.json()) as Record<string, unknown> });
    const answer = answers[Math.min(sent.length - 1, answers.length - 1)];
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { "content-type": "application/json" } });
  };
  return { fetch: fetchImpl as typeof fetch, sent };
}

function claudeMessage(content: unknown[], stopReason: string, extra: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content,
    stop_reason: stopReason,
    stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    ...extra,
  };
}

describe("claudeProvider", () => {
  it("turns tool use into calls and sends the assistant turn back unchanged with the results", async () => {
    const thinking = { type: "thinking", thinking: "Searching the catalogue first.", signature: "sig" };
    const toolUse = { type: "tool_use", id: "toolu_1", name: "search_catalog", input: { query: "milk" } };
    const { fetch, sent } = fakeFetch([
      { body: claudeMessage([thinking, toolUse], "tool_use") },
      { body: claudeMessage([{ type: "text", text: "Which milk?" }], "end_turn") },
    ]);
    const conversation = claudeProvider({ apiKey: "test-key", model: "claude-test", fetch }).open(START);

    const first = await conversation.next([], signal);
    expect(first).toEqual({
      status: "tool_calls",
      text: "Searching the catalogue first.",
      calls: [{ id: "toolu_1", name: "search_catalog", input: { query: "milk" } }],
    });
    expect(sent[0].headers.get("authorization")).toBe("Bearer test-key");
    expect(sent[0].headers.get("anthropic-beta")).toContain("thinking-display-updates-2026-08-18");
    expect(sent[0].body).toMatchObject({ model: "claude-test", system: "You buy milk.", tools: [{ name: "search_catalog" }] });

    const second = await conversation.next([{ callId: "toolu_1", name: "search_catalog", content: "No hits.", isError: false }], signal);
    expect(second).toEqual({ status: "final", text: "Which milk?" });
    expect(sent[1].body.messages).toEqual([
      { role: "user", content: "Milk, please." },
      { role: "assistant", content: [thinking, toolUse] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "No hits.", is_error: false }] },
    ]);
  });

  it("reports a refusal and turns an API error into a readable provider error", async () => {
    const refusal = claudeMessage([], "refusal", { stop_details: { type: "refusal", category: null, explanation: "Not allowed." } });
    const refused = fakeFetch([{ body: refusal }]);
    expect(await claudeProvider({ apiKey: "k", model: "m", fetch: refused.fetch }).open(START).next([], signal)).toEqual({
      status: "refused",
      detail: "Not allowed.",
    });

    const failing = fakeFetch([{ status: 400, body: { type: "error", error: { type: "invalid_request_error", message: "bad" } } }]);
    const attempt = claudeProvider({ apiKey: "k", model: "m", fetch: failing.fetch }).open(START).next([], signal);
    await expect(attempt).rejects.toThrow(new ProviderError("Claude answered with status 400."));
  });
});

describe("geminiProvider", () => {
  it("turns function calls into calls and keeps the model's parts for the next turn", async () => {
    const callPart = { functionCall: { name: "search_catalog", args: { query: "milk" } }, thoughtSignature: "opaque" };
    const { fetch, sent } = fakeFetch([
      { body: { candidates: [{ content: { role: "model", parts: [{ text: "Searching." }, callPart] }, finishReason: "STOP" }] } },
      { body: { candidates: [{ content: { role: "model", parts: [{ text: "Which milk?" }] }, finishReason: "STOP" }] } },
    ]);
    const conversation = geminiProvider({ apiKey: "g-key", model: "gemini-test", fetch }).open(START);

    const first = await conversation.next([], signal);
    expect(first).toEqual({ status: "tool_calls", text: "Searching.", calls: [{ id: "call_1_1", name: "search_catalog", input: { query: "milk" } }] });
    expect(sent[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect(sent[0].headers.get("x-goog-api-key")).toBe("g-key");
    expect(sent[0].body.tools).toEqual([{ functionDeclarations: [{ name: "search_catalog", description: "Search.", parametersJsonSchema: TOOLS[0].parameters }] }]);

    await conversation.next([{ callId: "call_1_1", name: "search_catalog", content: "No hits.", isError: false }], signal);
    expect(sent[1].body.contents).toEqual([
      { role: "user", parts: [{ text: "Milk, please." }] },
      { role: "model", parts: [{ text: "Searching." }, callPart] },
      { role: "user", parts: [{ functionResponse: { name: "search_catalog", response: { content: "No hits." } } }] },
    ]);
  });

  it("reports a safety stop and rejects an answer of the wrong shape", async () => {
    const blocked = fakeFetch([{ body: { candidates: [{ finishReason: "SAFETY" }] } }]);
    expect(await geminiProvider({ apiKey: "k", model: "m", fetch: blocked.fetch }).open(START).next([], signal)).toEqual({
      status: "refused",
      detail: "Stopped for safety.",
    });

    const odd = fakeFetch([{ body: { candidates: "none" } }]);
    await expect(geminiProvider({ apiKey: "k", model: "m", fetch: odd.fetch }).open(START).next([], signal)).rejects.toThrow(ProviderError);

    const down = fakeFetch([{ status: 503, body: {} }]);
    await expect(geminiProvider({ apiKey: "k", model: "m", fetch: down.fetch }).open(START).next([], signal)).rejects.toThrow(
      "Gemini answered with status 503.",
    );
  });
});
