import type { QuoteResponse, WorkspaceInfo } from "@/lib/contracts";
import { now, withClock } from "@/lib/clock";
import { tamperAudit } from "@/lib/demo";
import { gateway } from "@/lib/gateway";
import type { SignedMandate } from "@/lib/orders/types";
import { inWorkspace, sandboxes } from "@/lib/workspace";
import { approverCookie, mandate, monday, orderFrom, placeOrder, quoteLitres } from "./flow";
import { expectRefused, guardrail, outcomeText } from "./hostile";
import { AGENT_AUTH, get, ok, post, type Reply } from "./router";

/** Arla lactose-free fat-free milk drink: 51 counted units in the recording. */
const COUNTED = "462775";
const HOUR_MS = 3_600_000;

/** A private sandbox made the way llms.txt tells a curl user to, from its own client address. */
async function sandboxKey(address: string): Promise<Record<string, string>> {
  const info = ok<WorkspaceInfo>(await post("/api/v1/workspace", {}, { "x-forwarded-for": address }), "Sandbox");
  return { authorization: `Bearer ${info.agentKeys[0].key}` };
}

function quoteUnits(units: number, auth: Record<string, string> = AGENT_AUTH): Promise<Reply> {
  const body = { lines: [{ productId: COUNTED, quantity: { amount: units, unit: "sales_unit" } }], deliverBy: monday(), intent: `${units} units of product ${COUNTED} by Monday` };
  return post("/api/v1/quotes", body, auth);
}

const checkOf = (reply: Reply, rule: string) => orderFrom(reply)?.decision.checks.find((check) => check.rule === rule);

export const BINDING_GUARDRAILS = [
  guardrail("G26", "Another workspace's mandate, same id and version", "refused by mandate.signature: not the mandate in force here", async (hostile, checks) => {
    await gateway().updateMandate({ dietary: { excludeAllergens: ["milk"], blockMayContain: false, requiredClaims: [] } });
    const sandbox = await sandboxKey("203.0.113.26");
    // The sandbox's buyer raises its limits instead: its mandate is version 2 too, with the same id.
    const workspace = sandboxes().byAgentKey(sandbox.authorization.slice("Bearer ".length))!.workspace;
    await inWorkspace(workspace, () => gateway().updateMandate({ limits: { perOrder: { amount: 9000, currency: "EUR" }, perWeek: { amount: 90000, currency: "EUR" } } }));
    const foreign = ok<SignedMandate>(await get("/api/v1/mandate", sandbox), "Sandbox mandate");
    const local = await mandate();
    checks.expect(foreign.mandate.id === local.mandate.id && foreign.mandate.version === local.mandate.version, "the two mandates differ in id or version");
    const quote = await quoteLitres(100);
    const reply = await hostile.try("foreign mandate", () => placeOrder(quote.primary.jws, foreign.jws, "eval-g26-foreign-mandate"));
    expectRefused(reply, "mandate.signature", checks, "foreign mandate");
    checks.expect(orderFrom(reply)?.refusal?.code === "not_issued_here", `refusal ${orderFrom(reply)?.refusal?.code ?? "none"}, expected not_issued_here`);
    return outcomeText(reply);
  }),
  guardrail("G27", "An offer signed in another workspace", "refused by offer.signature here; ordered once where it was issued", async (hostile, checks) => {
    const sandbox = await sandboxKey("203.0.113.27");
    const foreign = ok<QuoteResponse>(await quoteUnits(10, sandbox), "Sandbox quote");
    const { jws } = await mandate();
    const here = await hostile.try("foreign offer", () => placeOrder(foreign.primary.jws, jws, "eval-g27-foreign-offer"));
    expectRefused(here, "offer.signature", checks, "foreign offer");
    checks.expect(orderFrom(here)?.refusal?.message === "Refused: the offer was not issued in this workspace.", "the refusal does not say the offer was not issued here");
    const own = ok<SignedMandate>(await get("/api/v1/mandate", sandbox), "Sandbox mandate");
    const there = await placeOrder(foreign.primary.jws, own.jws, "eval-g27-own-1", sandbox);
    const again = await hostile.try("same offer twice", () => placeOrder(foreign.primary.jws, own.jws, "eval-g27-own-2", sandbox));
    checks.expect(there.status === 201, `order where issued ${outcomeText(there)}, expected 201`);
    expectRefused(again, "offer.signature", checks, "second use");
    return `${outcomeText(here)}; issuer ${outcomeText(there)} then ${outcomeText(again)}`;
  }),
  guardrail("G28", "An order without the buyer's words", "202: request.words sends it to the approver", async (hostile, checks) => {
    const body = { lines: [{ productId: "464306", quantity: { amount: 10, unit: "l" } }], deliverBy: monday() };
    const quote = ok<QuoteResponse>(await post("/api/v1/quotes", body, AGENT_AUTH), "Quote without words");
    const { jws } = await mandate();
    const reply = await hostile.try("no words", () => placeOrder(quote.primary.jws, jws, "eval-g28-no-words"));
    checks.expect(reply.status === 202 && checkOf(reply, "request.words")?.status === "ask", `no words: ${outcomeText(reply)}, expected 202 with request.words ask`);
    return `${outcomeText(reply)}: ${checkOf(reply, "request.words")?.message ?? "no request.words check"}`;
  }),
  guardrail("G29", "One product split over lines", "15,000 + 15,000 l refused 422; 2 x 3,000 l untracked waits like 6,000 l", async (hostile, checks) => {
    const split = (litres: number) => ({
      lines: [1, 2].map(() => ({ productId: "464306", quantity: { amount: litres, unit: "l" } })),
      deliverBy: monday(),
      intent: `${litres * 2} litres of lactose-free milk by Monday`,
    });
    const huge = await hostile.try("2 x 15,000 l", () => post("/api/v1/quotes", split(15_000), AGENT_AUTH));
    checks.expect(huge.status === 422 && (huge.body as { code?: string }).code === "quantity_implausible", `2 x 15,000 l: ${outcomeText(huge)}, expected 422 quantity_implausible`);
    await gateway().updateMandate({ limits: { perOrder: { amount: 1_000_000, currency: "EUR" }, perWeek: { amount: 10_000_000, currency: "EUR" } } });
    const quote = ok<QuoteResponse>(await post("/api/v1/quotes", split(3000), AGENT_AUTH), "Split quote");
    const { jws } = await mandate();
    const reply = await hostile.try("2 x 3,000 l untracked", () => placeOrder(quote.primary.jws, jws, "eval-g29-split"));
    checks.expect(checkOf(reply, "delivery.partial")?.status === "ask", `2 x 3,000 l: ${outcomeText(reply)}, expected delivery.partial ask`);
    return `${outcomeText(huge)}; ${outcomeText(reply)}`;
  }),
  guardrail("G30", "Three orders of 30 against 51 in stock", "the first confirms; one quoted before it is refused at placement; the next quote shows 21 left", async (hostile, checks) => {
    const first = ok<QuoteResponse>(await quoteUnits(30), "First quote");
    const second = ok<QuoteResponse>(await quoteUnits(30), "Second quote");
    const { jws } = await mandate();
    const one = await placeOrder(first.primary.jws, jws, "eval-g30-one");
    const two = await hostile.try("stock already taken", () => placeOrder(second.primary.jws, jws, "eval-g30-two"));
    const third = ok<QuoteResponse>(await quoteUnits(30), "Third quote");
    const left = third.primary.offer.lines[0].availability.available;
    checks.expect(one.status === 201, `first ${outcomeText(one)}, expected 201`);
    expectRefused(two, "offer.expiry", checks, "stock taken");
    checks.expect(left === 21, `third quote shows ${left} available, expected 21`);
    return `${outcomeText(one)}; ${outcomeText(two)}; then ${left} left`;
  }),
  guardrail("G31", "Audit log known broken", "202: audit.integrity holds the order for a person", async (hostile, checks) => {
    await quoteLitres(10);
    await tamperAudit();
    const quote = await quoteLitres(10);
    const { jws } = await mandate();
    const reply = await hostile.try("order on a broken log", () => placeOrder(quote.primary.jws, jws, "eval-g31-broken"));
    checks.expect(reply.status === 202 && checkOf(reply, "audit.integrity")?.status === "ask", `broken log: ${outcomeText(reply)}, expected 202 with audit.integrity ask`);
    await gateway().reset();
    return outcomeText(reply);
  }),
  guardrail("G32", "Approval two hours after the offer was signed", "the price hold until the cut-off keeps it approvable: 200 confirmed", async (hostile, checks) => {
    const quote = await quoteLitres(3000);
    const { jws } = await mandate();
    const placed = orderFrom(await placeOrder(quote.primary.jws, jws, "eval-g32-hold"));
    checks.expect(placed?.priceHold?.heldUntil === placed?.offer.orderBy, `held until ${placed?.priceHold?.heldUntil}, expected the cut-off ${placed?.offer.orderBy}`);
    const cookie = await approverCookie();
    const later = new Date(now().getTime() + 2 * HOUR_MS);
    const reply = await withClock(() => later, () => hostile.try("approve two hours later", () => post(`/api/v1/approvals/${placed?.id}`, { decision: "approved" }, { cookie })));
    checks.expect(reply.status === 200 && (reply.body as { status?: string }).status === "confirmed", `approval two hours later: ${reply.status} ${(reply.body as { status?: string }).status}`);
    return `${reply.status} ${(reply.body as { status?: string }).status}, held until ${placed?.priceHold?.heldUntil}`;
  }),
];
