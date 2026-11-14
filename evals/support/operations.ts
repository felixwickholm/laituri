import type { Order } from "@/lib/contracts";
import { EXAMPLES } from "@/lib/openapi/examples";
import { OPERATIONS, type Operation } from "@/lib/openapi/registry";
import { MILK_ID, approverCookie, mandate, monday, operatorCookie, orderLitres, quoteLitres } from "./flow";
import { pendingOrder } from "./hostile";
import { AGENT_AUTH, call } from "./router";

interface Context {
  offerId: string;
  offerJws: string;
  mandateJws: string;
  orderId: string;
  pendingId: string;
  cookie: string;
  operatorCookie: string;
}

interface Recipe {
  params?: Record<string, string>;
  query?: string;
  body?: unknown;
  /** The answer documented for this environment, when it is not the success status. */
  expect?: number;
}

/** A well-formed request for every registered operation. */
const RECIPES: Record<string, (ctx: Context) => Recipe> = {
  searchCatalog: () => ({ body: EXAMPLES.search.request }),
  getProduct: () => ({ params: { id: MILK_ID } }),
  requestQuote: () => ({ body: { ...EXAMPLES.quote.request, deliverBy: monday() } }),
  getOffer: (ctx) => ({ params: { id: ctx.offerId } }),
  placeOrder: (ctx) => ({ body: { offerJws: ctx.offerJws, mandateJws: ctx.mandateJws, idempotencyKey: "eval-openness-order" } }),
  listOrders: () => ({}),
  getOrder: (ctx) => ({ params: { id: ctx.orderId } }),
  listPendingApprovals: () => ({}),
  decideApproval: (ctx) => ({ params: { orderId: ctx.pendingId }, body: { decision: "rejected", note: "Checked by the evaluation." } }),
  getMandate: () => ({}),
  updateMandate: () => ({ body: { limits: { perOrder: { amount: 1500, currency: "EUR" } } } }),
  getAuditLog: () => ({ query: "?after=0" }),
  verifyAudit: () => ({}),
  getAuditCheckpoint: () => ({}),
  listActivity: () => ({}),
  getSupplierOverview: () => ({}),
  // Resuming an agent that is not suspended changes nothing, so the calls after this one are still served.
  setAgentSuspension: () => ({ params: { agentId: "agent:harbour-purchasing" }, body: { suspended: false } }),
  resetDemo: () => ({}),
  getHealth: () => ({}),
  getVoice: () => ({}),
  // The evals run without an ElevenLabs key, so the documented answer is 404 voice_not_configured.
  speakText: () => ({ body: { text: "Order confirmed." }, expect: 404 }),
  getWorkspace: () => ({}),
  createWorkspace: () => ({}),
  setWorkspaceView: () => ({ body: { view: "sandbox" } }),
};

async function context(): Promise<Context> {
  const quote = await quoteLitres(200);
  const order: Order = await orderLitres(200, "eval-openness-setup");
  const pending = await pendingOrder("eval-openness-pending");
  return {
    offerId: quote.primary.offer.id,
    offerJws: quote.primary.jws,
    mandateJws: (await mandate()).jws,
    orderId: order.id,
    pendingId: pending.id,
    cookie: await approverCookie(),
    operatorCookie: await operatorCookie(),
  };
}

export interface OperationResult {
  operation: Operation;
  status: number;
  problem?: string;
}

function headersFor(operation: Operation, ctx: Context): Record<string, string> {
  if (operation.audience === "human") return { cookie: ctx.cookie };
  if (operation.audience === "operator") return { cookie: ctx.operatorCookie };
  return operation.audience === "agent" || operation.audience === "reader" ? AGENT_AUTH : {};
}

/** Calls every operation once, the reset last, and compares the status with the documented success status. */
export async function callEveryOperation(): Promise<OperationResult[]> {
  const ctx = await context();
  const ordered = [...OPERATIONS].sort((a, b) => Number(a.operationId === "resetDemo") - Number(b.operationId === "resetDemo"));
  const results: OperationResult[] = [];
  for (const operation of ordered) {
    const recipe = RECIPES[operation.operationId]?.(ctx);
    if (!recipe) {
      results.push({ operation, status: 0, problem: "no request recipe for this operation" });
      continue;
    }
    const path = operation.path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(recipe.params?.[name] ?? ""));
    const reply = await call(operation.method, path + (recipe.query ?? ""), { body: recipe.body, headers: headersFor(operation, ctx) });
    const documented = recipe.expect ?? operation.status ?? 200;
    const problem = reply.status === documented ? undefined : `${reply.status}, documented ${documented}: ${(reply.body as { detail?: string })?.detail ?? ""}`.trim();
    results.push({ operation, status: reply.status, problem });
  }
  return results;
}
