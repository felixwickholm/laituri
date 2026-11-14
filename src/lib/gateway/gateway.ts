import { z } from "zod";
import {
  ApprovalDecisionRequest,
  PlaceOrderRequest,
  QuoteRequest,
  SearchRequest,
  SuspensionRequest,
  type Actor,
  type QuoteResponse,
} from "@/lib/contracts";
import { supplierOverview } from "@/lib/insights";
import { quote, type QuoteContext } from "@/lib/offers";
import { offerSubject, productName } from "@/lib/offers/format";
import * as orders from "@/lib/orders";
import { SUPPLIER_ACTOR, agentActor } from "@/lib/orders/summaries";
import { matchConfidence } from "./confidence";
import { recordQuote, recordSearch } from "./demand";
import { AuditBrokenError, NotFoundError, ValidationError } from "./errors";
import { offerSummary, orderDetail, orderStatus, orderTitle, quoteDetail, quoteTitle, searchDetail } from "./describe";
import { withPreviews } from "./preview";
import { createRecorder } from "./recorder";
import { createSuspensions } from "./suspension";
import type { AgentRef, Deps, Gateway } from "./types";

const Party = z.object({ id: z.string().min(1), name: z.string().min(1) });
const Agent = Party.extend({ buyer: Party.optional(), client: z.string().min(1).max(80).optional() });

function validate<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
  throw new ValidationError(`The ${what} is not valid${where}: ${issue?.message ?? "unknown problem"}.`, parsed.error.issues);
}

export function createGateway(deps: Deps): Gateway {
  const recorder = createRecorder(deps);
  const suspensions = createSuspensions(deps, recorder);
  /** A validated caller that the wholesaler has not suspended. */
  async function caller(agentInput: AgentRef, call: string): Promise<AgentRef> {
    const agent = validate(Agent, agentInput, "agent");
    await suspensions.admit(agent, call);
    return agent;
  }

  /** The buyer an agent works for. An agent without a token acts in the primary buyer's context. */
  async function buyerOf(agent: AgentRef): Promise<{ id: string; name: string; customerNumber: string }> {
    const { mandate } = await deps.mandates.current(agent.buyer?.id);
    return mandate.buyer;
  }

  /** The buyer a console call means: the one named, else the primary buyer, whose mandate the service gives by default. */
  async function buyerId(named?: string): Promise<string> {
    return named ?? (await deps.mandates.current()).mandate.buyer.id;
  }

  /** Prices and signs a quote, and logs the offer it issued. */
  async function issueQuote(request: QuoteRequest, ctx: QuoteContext): Promise<QuoteResponse> {
    const response = await quote(request, ctx, deps);
    const { offer } = response.primary;
    await deps.audit.append({
      actor: SUPPLIER_ACTOR,
      event: "offer.issued",
      summary: offerSummary(offer, response.alternatives.length),
      refs: { offerId: offer.id, buyerId: ctx.buyer.id },
      data: {
        totals: offer.totals,
        fulfilment: offer.fulfilment,
        deliveryDate: offer.deliveryDate,
        expiresAt: offer.expiresAt,
        alternatives: response.alternatives.length,
        alternativeOfferIds: response.alternatives.map((alt) => alt.signed.offer.id),
      },
    });
    return response;
  }

  return {
    async searchCatalog(agentInput, input) {
      const agent = await caller(agentInput, "search_catalog");
      const request = validate(SearchRequest, input, "search request");
      return recorder.track(agent, "search_catalog", `Searched the catalogue for '${request.query}'`, async () => {
        const response = await withPreviews(deps.catalog.search(request), request, deps, agent.buyer?.id);
        await deps.audit.append({
          actor: agentActor(agent),
          event: "catalog.searched",
          summary: `${agent.name} searched the catalogue for '${request.query}' and found ${response.hits.length} products.`,
          refs: agent.buyer ? { buyerId: agent.buyer.id } : {},
          data: {
            query: request.query,
            filters: request.filters ?? {},
            interpretation: response.interpretation,
            hits: response.hits.slice(0, 5).map((hit) => hit.product.id),
            need: request.need,
            previews: response.hits.filter((hit) => hit.offerPreview).length,
          },
        });
        await recordSearch(agent, request, response, deps);
        return response;
      }, (response) => ({ detail: searchDetail(response) }));
    },

    async getProduct(agentInput, id) {
      const agent = await caller(agentInput, "get_product");
      return recorder.track(agent, "get_product", `Looked up product ${id}`, async () => {
        const product = deps.catalog.get(id);
        if (!product) throw new NotFoundError(`Product ${id} is not in the catalogue.`);
        return product;
      }, (product) => ({ detail: productName(product) }));
    },

    async requestQuote(agentInput, input) {
      const agent = await caller(agentInput, "request_quote");
      const request = validate(QuoteRequest, input, "quote request");
      return recorder.track(agent, "request_quote", quoteTitle(request, deps.catalog), async () => {
        const { customerNumber, ...buyer } = await buyerOf(agent);
        const checked = { ...request, matchConfidence: matchConfidence(request, deps.catalog) };
        const response = await issueQuote(checked, { customerNumber, buyer });
        await recordQuote(agent, checked, response, deps);
        return response;
      }, (response) => ({ detail: quoteDetail(response), refs: { offerId: response.primary.offer.id } }));
    },

    async placeOrder(agentInput, input) {
      const agent = await caller(agentInput, "place_order");
      const request = validate(PlaceOrderRequest, input, "order request");
      return recorder.track(agent, "place_order", "Placed an order", () => orders.placeOrder(request, deps, agent), (order) => ({
        title: orderTitle(order),
        detail: orderDetail(order),
        status: orderStatus(order),
        refs: { orderId: order.id, offerId: order.offer.id },
      }));
    },

    async getOrder(agentInput, id) {
      const agent = await caller(agentInput, "get_order");
      return recorder.track(agent, "get_order", `Checked order ${id}`, async () => {
        const order = await orders.getOrder(id, deps);
        // For an agent holding a buyer's token, another buyer's order does not exist.
        if (agent.buyer && order.buyer.id !== agent.buyer.id) throw new NotFoundError(`Order ${id} was not found.`);
        return order;
      }, (order) => ({
        detail: orderDetail(order),
        refs: { orderId: order.id, offerId: order.offer.id },
      }));
    },

    listOrders: async (named) => orders.listOrders(await buyerId(named), deps),
    pendingApprovals: async (named) => orders.pendingApprovals(await buyerId(named), deps),

    async decideApproval(orderId, input, named) {
      const decider = { ...named, buyerId: await buyerId(named?.buyerId) };
      const body = validate(ApprovalDecisionRequest, input, "approval decision");
      if (body.decision === "approved") {
        const log = await deps.audit.verify();
        if (!log.valid) throw new AuditBrokenError(`Approvals are paused. ${log.reason ?? "The audit log does not verify."}`);
      }
      const order = await orders.decideApproval(orderId, body, deps, decider);
      const title = order.approval
        ? `${order.approval.decidedBy.name} ${order.approval.decision} the order for ${offerSubject(order.offer)}`
        : order.status === "blocked"
          ? "The approval was stopped: the mandate in force no longer allows the order"
          : "The offer expired before approval";
      await recorder.note({ ...order.agent, buyer: order.buyer }, title, {
        detail: orderDetail(order),
        status: orderStatus(order),
        refs: { orderId: order.id, offerId: order.offer.id },
      });
      return order;
    },

    requote(order) {
      const { offer } = order;
      const lines = offer.lines
        .filter((line) => line.quantity > 0)
        .map((line) => ({ productId: line.productId, quantity: { amount: line.quantity, unit: "sales_unit" as const } }));
      return issueQuote(
        { lines, deliverBy: offer.deliverBy, intent: offer.intent, matchConfidence: offer.matchConfidence },
        { customerNumber: offer.customerNumber, buyer: order.buyer },
      );
    },

    getMandate: (named) => deps.mandates.current(named),

    async updateMandate(patch, decider) {
      const updated = await deps.mandates.update(patch, decider?.buyerId).catch((error: unknown) => {
        if (error instanceof z.ZodError) throw new ValidationError("The mandate change is not valid.", error.issues);
        throw error;
      });
      const { mandate } = updated;
      const buyer: Actor = { type: "human", id: mandate.buyer.id, name: mandate.buyer.name };
      await deps.audit.append({
        actor: buyer,
        event: "mandate.updated",
        summary: `${mandate.buyer.name} updated the mandate to version ${mandate.version}.`,
        refs: { mandateId: mandate.id, buyerId: mandate.buyer.id },
        data: { version: mandate.version, changed: Object.keys(patch), patch, ...(decider?.via ? { via: decider.via } : {}) },
      });
      return updated;
    },

    auditLog: (afterSeq) => deps.store.audit.list(afterSeq),
    verifyAudit: () => deps.audit.verify(),

    async activity(afterId, named) {
      const id = await buyerId(named);
      return (await deps.store.activity.list(afterId)).filter((item) => !item.buyer || item.buyer.id === id);
    },

    async supplierOverview() {
      const [orderList, offers, requests, activity, suspended, audit] = await Promise.all([
        deps.store.orders.list(),
        deps.store.offers.list(),
        deps.store.requests.list(),
        deps.store.activity.list(),
        deps.store.suspensions.list(),
        deps.store.audit.list(),
      ]);
      return supplierOverview({ now: deps.now(), orders: orderList, offers, requests, activity, suspensions: suspended, audit });
    },

    async admitAgent(agentInput, call) {
      await caller(agentInput, call);
    },

    async setAgentSuspension(agentId, input, operator) {
      return suspensions.set(agentId, validate(SuspensionRequest, input, "suspension request"), operator);
    },

    async reset() {
      await deps.store.reset();
      deps.audit.forget?.();
      recorder.reset();
    },
  };
}
