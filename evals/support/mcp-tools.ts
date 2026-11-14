import { z } from "zod";
import { MILK_ID, monday } from "./flow";
import { callTool, rpc, type ToolResult } from "./mcp";

export interface ListedTool {
  name: string;
  inputSchema?: { type?: string };
  outputSchema?: Record<string, unknown> & { type?: string; required?: string[] };
}

type State = Record<string, string>;

/** Valid arguments per tool, in an order where each tool can use what the earlier ones returned. */
const RECIPES: [name: string, args: (state: State) => Record<string, unknown>, keep?: (result: Record<string, unknown>, state: State) => void][] = [
  ["search_catalog", () => ({ query: "laktoositon maito", limit: 3 })],
  ["get_product", () => ({ productId: MILK_ID })],
  ["request_quote", () => ({ lines: [{ productId: MILK_ID, quantity: { amount: 100, unit: "l" } }], deliverBy: monday(), matchConfidence: "high" }),
    (result, state) => { state.offerJws = (result.primary as { jws: string }).jws; }],
  ["get_mandate", () => ({}), (result, state) => { state.mandateJws = String(result.jws); }],
  ["place_order", (state) => ({ offerJws: state.offerJws, mandateJws: state.mandateJws, idempotencyKey: "eval-mcp-order-0001" }),
    (result, state) => { state.orderId = String(result.id); }],
  ["get_order", (state) => ({ orderId: state.orderId })],
  ["place_basket", () => ({ deliverBy: monday(), lines: [{ words: "lactose-free milk", quantity: { amount: 100, unit: "l" } }, { words: "eggs", quantity: { amount: 12, unit: "kg" } }] })],
  ["verify_audit", () => ({})],
  ["plan_menu", () => ({ words: "We have a wedding on Saturday with 80 guests. Three courses." })],
  ["list_recipes", () => ({})],
  ["plan_event", () => ({ words: "We have a wedding on Saturday with 80 guests, no nuts." })],
];

export async function listTools(): Promise<ListedTool[]> {
  const { result } = await rpc<{ tools: ListedTool[] }>("tools/list");
  return result?.tools ?? [];
}

/** Validates against the published output schema; a schema zod cannot read falls back to its required keys. */
function matchesSchema(schema: ListedTool["outputSchema"], value: unknown): { ok: boolean; how: string; issue?: string } {
  if (!schema) return { ok: false, how: "none", issue: "no output schema" };
  try {
    const parsed = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]).safeParse(value);
    return { ok: parsed.success, how: "zod", issue: parsed.success ? undefined : parsed.error.issues[0]?.message };
  } catch {
    const missing = (schema.required ?? []).filter((key) => !(value && typeof value === "object" && key in value));
    return { ok: missing.length === 0, how: "required keys", issue: missing.length ? `missing ${missing.join(", ")}` : undefined };
  }
}

export interface ToolCallResult {
  name: string;
  ok: boolean;
  how: string;
  problem?: string;
}

/** Calls each listed tool once with valid arguments and checks its structured result. */
export async function callEveryTool(tools: ListedTool[]): Promise<ToolCallResult[]> {
  const state: State = {};
  const results: ToolCallResult[] = [];
  const known = new Set(RECIPES.map(([name]) => name));
  for (const tool of tools.filter((t) => !known.has(t.name))) results.push({ name: tool.name, ok: false, how: "none", problem: "no arguments recipe" });
  for (const [name, args, keep] of RECIPES) {
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      results.push({ name, ok: false, how: "none", problem: "not listed" });
      continue;
    }
    const { result, error } = await callTool(name, args(state));
    const structured = (result as ToolResult | undefined)?.structuredContent;
    if (error || result?.isError || !structured) {
      results.push({ name, ok: false, how: "none", problem: error?.message ?? result?.content?.[0]?.text ?? "no structured content" });
      continue;
    }
    keep?.(structured, state);
    const check = matchesSchema(tool.outputSchema, structured);
    results.push({ name, ok: check.ok, how: check.how, problem: check.issue });
  }
  return results;
}
