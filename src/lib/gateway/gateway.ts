import { z } from "zod";
import {
  ApprovalDecisionRequest,
  PlaceOrderRequest,
  QuoteRequest,
  SearchRequest,
  type Actor,
} from "@/lib/contracts";
import { quote } from "@/lib/offers";
import { offerSubject, productName } from "@/lib/offers/format";
import * as orders from "@/lib/orders";
import { SUPPLIER_ACTOR, agentActor } from "@/lib/orders/summaries";
import { matchConfidence } from "./confidence";
import { AuditBrokenError, NotFoundError, ValidationError } from "./errors";
import { offerSummary, orderDetail, orderStatus, orderTitle, quoteDetail, quoteTitle, searchDetail } from "./describe";
import { withPreviews } from "./preview";
import { createRecorder } from "./recorder";
import type { AgentRef, Deps, Gateway } from "./types";

const Agent = z.object({ id: z.string().min(1), name: z.string().min(1) });

function validate<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
  throw new ValidationError(`The ${what} is not valid${where}: ${issue?.message ?? "unknown problem"}.`, parsed.error.issues);
}

export function createGateway(deps: Deps): Gateway {
  const recorder = createRecorder(deps);
  const caller = (agent: AgentRef) => validate(Agent, agent, "agent");

  return {
    async searchCatalog(agentInput, input) {
      const agent = caller(agentInput);
      const request = validate(SearchRequest, input, "search request");
      return recorder.track(agent, "search_catalog", `Searched the catalogue for '${request.query}'`, async () => {
        const response = await withPreviews(deps.catalog.search(request), request, deps);
        await deps.audit.append({
          actor: agentActor(agent),
          event: "catalog.searched",
          summary: `${agent.name} searched the catalogue for '${request.query}' and found ${response.hits.length} products.`,
          data: {
            query: request.query,
            filters: request.filters ?? {},
            interpretation: response.interpretation,
            hits: response.hits.slice(0, 5).map((hit) => hit.product.id),
            need: request.need,
            previews: response.hits.filter((hit) => hit.offerPreview).length,
          },
        });
        return response;
      }, (response) => ({ detail: searchDetail(response) }));
    },

    async getProduct(agentInput, id) {
      const agent = caller(agentInput);
      return recorder.track(agent, "get_product", `Looked up product ${id}`, async () => {
        const product = deps.catalog.get(id);
        if (!product) throw new NotFoundError(`Product ${id} is not in the catalogue.`);
        return product;
      }, (product) => ({ detail: productName(product) }));
    },

    async requestQuote(agentInput, input) {
      const agent = caller(agentInput);
      const request = validate(QuoteRequest, input, "quote request");
      return recorder.track(agent, "request_quote", quoteTitle(request, deps.catalog), async () => {
        const { mandate } = await deps.mandates.current();
        const checked = { ...request, matchConfidence: matchConfidence(request, deps.catalog) };
        const response = await quote(checked, { customerNumber: mandate.buyer.customerNumber }, deps);
        const { offer } = response.primary;
        await deps.audit.append({
          actor: SUPPLIER_ACTOR,
          event: "offer.issued",
          summary: offerSummary(offer, response.alternatives.length),
          refs: { offerId: offer.id },
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
      }, (response) => ({ detail: quoteDetail(response), refs: { offerId: response.primary.offer.id } }));
    },

    async placeOrder(agentInput, input) {
      const agent = caller(agentInput);
      const request = validate(PlaceOrderRequest, input, "order request");
      return recorder.track(agent, "place_order", "Placed an order", () => orders.placeOrder(request, deps, agent), (order) => ({
        title: orderTitle(order),
        detail: orderDetail(order),
        status: orderStatus(order),
        refs: { orderId: order.id, offerId: order.offer.id },
      }));
    },

    async getOrder(agentInput, id) {
      const agent = caller(agentInput);
      return recorder.track(agent, "get_order", `Checked order ${id}`, () => orders.getOrder(id, deps), (order) => ({
        detail: orderDetail(order),
        refs: { orderId: order.id, offerId: order.offer.id },
      }));
    },

    listOrders: () => orders.listOrders(deps),
    pendingApprovals: () => orders.pendingApprovals(deps),

    async decideApproval(orderId, input) {
      const body = validate(ApprovalDecisionRequest, input, "approval decision");
      if (body.decision === "approved") {
        const log = await deps.audit.verify();
        if (!log.valid) throw new AuditBrokenError(`Approvals are paused. ${log.reason ?? "The audit log does not verify."}`);
      }
      const order = await orders.decideApproval(orderId, body, deps);
      const title = order.approval
        ? `${order.approval.decidedBy.name} ${order.approval.decision} the order for ${offerSubject(order.offer)}`
        : "The offer expired before approval";
      await recorder.note(order.agent, title, {
        detail: orderDetail(order),
        status: orderStatus(order),
        refs: { orderId: order.id, offerId: order.offer.id },
      });
      return order;
    },

    getMandate: () => deps.mandates.current(),

    async updateMandate(patch) {
      const updated = await deps.mandates.update(patch).catch((error: unknown) => {
        if (error instanceof z.ZodError) throw new ValidationError("The mandate change is not valid.", error.issues);
        throw error;
      });
      const { mandate } = updated;
      const buyer: Actor = { type: "human", id: mandate.buyer.id, name: mandate.buyer.name };
      await deps.audit.append({
        actor: buyer,
        event: "mandate.updated",
        summary: `${mandate.buyer.name} updated the mandate to version ${mandate.version}.`,
        refs: { mandateId: mandate.id },
        data: { version: mandate.version, changed: Object.keys(patch), patch },
      });
      return updated;
    },

    auditLog: (afterSeq) => deps.store.audit.list(afterSeq),
    verifyAudit: () => deps.audit.verify(),
    activity: (afterId) => deps.store.activity.list(afterId),

    async reset() {
      await deps.store.reset();
      deps.audit.forget?.();
      recorder.reset();
    },
  };
}
