import type { Basket, Order } from "@/lib/contracts";
import { EXAMPLES } from "@/lib/openapi/examples";
import { OPERATIONS, type Operation } from "@/lib/openapi/registry";
import { MILK_ID, approverCookie, mandate, monday, operatorCookie, orderLitres, quoteLitres } from "./flow";
import { pendingOrder } from "./hostile";
import { AGENT_AUTH, call, get, ok, post } from "./router";

interface Context {
  offerId: string;
  offerJws: string;
  mandateJws: string;
  orderId: string;
  pendingId: string;
  cookie: string;
  operatorCookie: string;
  /** A finished basket whose one line waits for a person. */
  basket: Basket;
  handoffId: string;
}

interface Recipe {
  params?: Record<string, string>;
  query?: string;
  body?: unknown;
  /** The answer documented for this environment, when it is not the success status. */
  expect?: number;
  /** Sent as the approver's session cookie, for public operations that still serve only a browser or a person. */
  session?: boolean;
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
  // The evals run without an ElevenLabs key, so the documented answer is 404 voice_not_configured. Voice serves only a
  // browser sandbox or a signed-in person, so these carry the approver's session.
  speakText: () => ({ body: { text: "Order confirmed." }, expect: 404, session: true }),
  streamSpeech: () => ({ query: "?text=Order%20confirmed.", expect: 404, session: true }),
  transcribeSpeech: () => ({ query: "?language=fi-FI", body: { audio: "none" }, expect: 404, session: true }),
  getWorkspace: () => ({}),
  createWorkspace: () => ({}),
  setWorkspaceView: () => ({ body: { view: "sandbox" } }),
  planMenu: () => ({ body: { words: "Dinner for 80 on Friday, no nuts" } }),
  listRecipes: () => ({}),
  assistantTurn: () => ({ body: { words: "We have a wedding on Saturday with 80 guests, no nuts." } }),
  getRecipe: () => ({ params: { id: "pasta-bolognese" } }),
  getPantry: () => ({}),
  listSuggestions: () => ({}),
  createBasket: () => ({ body: { deliverBy: monday(), lines: [{ words: "lactose-free milk", quantity: { amount: 200, unit: "l" } }] } }),
  listBaskets: () => ({}),
  getBasket: (ctx) => ({ params: { basketId: ctx.basket.id } }),
  startWeeklyBasket: () => ({}),
  getWeeklyDraft: () => ({}),
  resolveBasketLine: (ctx) => {
    const [line] = ctx.basket.lines;
    return { params: { basketId: ctx.basket.id, lineId: line.id }, body: { optionId: line.options?.find((option) => option.kind === "skip")?.id } };
  },
  createHandoff: (ctx) => ({ body: { basketId: ctx.basket.id, lineId: ctx.basket.lines[0].id, words: "Can you hold this price until Monday?" } }),
  listHandoffs: () => ({}),
  answerHandoff: (ctx) => ({ params: { handoffId: ctx.handoffId }, body: { words: "Yes, held until Monday 16:00." } }),
};

const MAX_POLLS = 400;

/** A basket of one line over the per-order limit, finished, so a person has options on it. */
async function waitingBasket(): Promise<Basket> {
  const lines = [{ words: "lactose-free milk", quantity: { amount: 1600, unit: "l" } }];
  const { basketId } = ok<{ basketId: string }>(await post("/api/v1/baskets", { deliverBy: monday(), lines }, AGENT_AUTH), "Basket");
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    const basket = ok<Basket>(await get(`/api/v1/baskets/${basketId}`, AGENT_AUTH), "Basket");
    if (basket.status === "done") return basket;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Basket ${basketId} did not finish.`);
}

async function context(): Promise<Context> {
  const quote = await quoteLitres(200);
  const order: Order = await orderLitres(200, "eval-openness-setup");
  const pending = await pendingOrder("eval-openness-pending");
  const cookie = await approverCookie();
  const basket = await waitingBasket();
  const handoff = ok<{ id: string }>(await post("/api/v1/handoffs", { words: "Please call me about the milk." }, { cookie }), "Hand-off");
  return {
    offerId: quote.primary.offer.id,
    offerJws: quote.primary.jws,
    mandateJws: (await mandate()).jws,
    orderId: order.id,
    pendingId: pending.id,
    cookie,
    operatorCookie: await operatorCookie(),
    basket,
    handoffId: handoff.id,
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
    const headers = recipe.session ? { cookie: ctx.cookie } : headersFor(operation, ctx);
    const reply = await call(operation.method, path + (recipe.query ?? ""), { body: recipe.body, headers });
    const documented = recipe.expect ?? operation.status ?? 200;
    const problem = reply.status === documented ? undefined : `${reply.status}, documented ${documented}: ${(reply.body as { detail?: string })?.detail ?? ""}`.trim();
    results.push({ operation, status: reply.status, problem });
  }
  return results;
}
