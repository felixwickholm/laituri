import type { Assumption, Facts, ProductionStep } from "./types";

/** What the demo simulates or assumes. Each item names where it lives, so a reviewer can check it. */
export function simulated(f: Facts): Assumption[] {
  return [
    { topic: "Orders", text: "Orders are simulated. The mock API has price and availability but no order endpoint, so Laituri creates the order, the receipt and the log entry itself and marks every order simulated: true.", where: ["src/lib/orders/confirm.ts"] },
    { topic: "Keys", text: "One server holds all three private keys (buyer, supplier, approver) in .data/keys, so one deployment plays all three parties. In production each party keeps its own key.", where: ["src/lib/trust/keys.ts"] },
    { topic: "Agent identity", text: `Agents use demo bearer tokens, one per demo buyer (demo-agent-token, demo-kaisla-token, demo-laine-token), instead of OAuth 2.1. The OAuth protected-resource metadata is already published.`, where: ["src/lib/http/agent.ts", "src/app/.well-known/oauth-protected-resource/route.ts"] },
    { topic: "Demo buyers", text: `${f.demoBuyers} demo buyers (${f.buyerNames.join(", ")}) trade under the mock API's one customer number; the signed buyer id keeps them apart.`, where: ["src/lib/mandate/defaults.ts"] },
    { topic: "Seeded history", text: `On an empty state the server plays ${f.seededRequests} requests by the demo buyers over about a week through the real gateway, at past times. Every offer, order, approval and audit entry is signed and chained as in live use, and marked seeded. LAITURI_SEED=off turns it off.`, where: ["src/lib/seed/plan.ts", "src/lib/seed/index.ts"] },
    { topic: "Demo access", text: "One click signs a visitor in as the hotel's approver without the passcode; each approval or mandate change made that way says \"demo access\" in the audit log. LAITURI_DEMO_ACCESS=off disables it.", where: ["src/lib/http/console-session.ts"] },
    { topic: "Open reading", text: "Orders, approvals, the mandate and the audit log can be read without signing in, so anyone can watch. They hold synthetic data only. Production puts every read behind each party's own access control.", where: ["src/lib/http/buyer-scope.ts"] },
    { topic: "Demo controls", text: "Starting a scene, altering one log entry to show detection and suspending an agent are open to visitors and refuse agent credentials; reset needs the approver. The altered entry is put back after five minutes. A production deployment has none of these controls open.", where: ["src/lib/demo/tamper.ts", "src/app/api/v1/demo/reset/route.ts"] },
    { topic: "State", text: "State is kept in memory with a JSON snapshot. One process serialises order decisions, so two orders cannot pass a limit together.", where: ["src/lib/store/memory.ts", "src/lib/orders/lock.ts"] },
    { topic: "Recorded mode", text: `Without an API key, recorded price and availability answers for ${f.recordedProducts} products replay with a fixed clock. Tests and evals always use this mode.`, where: ["src/lib/valio/recorded.ts", "fixtures/upstream"] },
    { topic: "Product concepts", text: "Category groups and the product concept list are our own, built from the product data. \"Lactose-free milk\" is sold as \"lactose-free milk drink\"; Laituri treats them as one request and shows the product name it chose.", where: ["src/lib/catalog/build/groups.ts", "src/lib/catalog/lexicon.ts"] },
    { topic: "Upstream data", text: "A closingTime in the past means that delivery date can no longer be ordered. An available amount of 9999999999 or 999999 means no tracked limit. Availability returns the next delivery date whatever date is asked; Laituri compares it with the requested date.", where: ["src/lib/valio/normalise.ts"] },
    { topic: "Pack contents", text: "Litres or kilograms per sales unit come from the product's unit data, else from the price divided by the comparison price.", where: ["src/lib/offers/packs.ts"] },
    { topic: "Carbon figure", text: "The CO2 figure is the average for the product's category (categoryAverageCo2PerKg), not a measurement of the product.", where: ["src/lib/contracts/facts.ts"] },
    { topic: "Match confidence", text: "The agent may state how sure it is of a match, but the wholesaler checks the buyer's words against its own catalogue and never reports a higher confidence than it finds.", where: ["src/lib/gateway/confidence.ts"] },
    { topic: "Approver judgement", text: "An approver can approve several waiting orders that together pass the weekly limit. That is the approver's decision; each order shows the limit it passed.", where: ["src/lib/orders/approval.ts"] },
    { topic: "Audit completeness", text: "Verification proves that entries were not changed, reordered or removed from the middle. That the newest entries are still there is checked against the last head the verifier saw. While the log does not verify, approvals are paused.", where: ["src/lib/audit/verify.ts", "src/lib/audit/head.ts", "src/lib/gateway/gateway.ts"] },
    { topic: "Buyer agent", text: "The fixed demo scenes, the tests and the evals use a scripted buyer agent, so results repeat. Free-text requests use Claude or Gemini when a key is set, else the scripted agent.", where: ["src/lib/agent/purchase.ts", "src/lib/agent/llm/engine.ts"] },
    { topic: "Voice", text: "Spoken input uses the browser's Web Speech API. Spoken answers use the browser's voice, or ElevenLabs when a key is set on the server.", where: ["src/lib/voice/speech-to-text.ts", "src/lib/voice/text-to-speech.ts"] },
  ];
}

/** Named in the brief and not built. */
export function notBuilt(): Assumption[] {
  return [
    { topic: "Recipes", text: "No recipe model: substitutes are like for like, not recipe-compatible.", where: [] },
    { topic: "Kitchen stock", text: "The agent does not read the kitchen's own stock or ERP.", where: [] },
    { topic: "Proactive selling", text: "No wholesaler agent that pushes products to buyers' agents.", where: [] },
    { topic: "Standing orders", text: "No recurring orders and no drift detection.", where: [] },
    { topic: "Payments", text: "No agentic payment (x402 or similar); orders follow the buyer's existing account terms.", where: [] },
    { topic: "Peppol documents", text: "The receipt carries Peppol order-response codes, but no UBL document is produced.", where: [] },
    { topic: "Nutrition rules", text: "Allergens and claims are checked; nutrition values are not.", where: [] },
  ];
}

export function production(): ProductionStep[] {
  return [
    { step: "Real order entry", why: "Replace the simulated order with the ERP's order entry and return its order number in the signed receipt.", where: ["src/lib/orders/confirm.ts"] },
    { step: "OAuth 2.1 per agent", why: "Scoped tokens (catalog:read, quote:create, order:place) in place of demo tokens. The scopes are already declared in the OpenAPI document and the protected-resource metadata.", where: ["src/lib/discovery/documents.ts", "src/lib/openapi/registry.ts"] },
    { step: "Key custody per party", why: "The wholesaler runs Laituri with the supplier key only; the buyer signs mandates in its own system; the approver signs with a personal credential.", where: ["src/lib/trust/keys.ts"] },
    { step: "Buyer identity", why: "A verifiable organisation credential (the planned EU Business Wallet) instead of a demo key.", where: [] },
    { step: "Mandate copy at the wholesaler", why: "Keep the signed mandate in the customer master as well, so both sides hold the same signed copy.", where: ["src/lib/mandate/index.ts"] },
    { step: "Database", why: "Transactions and row locks in place of the single-process store.", where: ["src/lib/store/types.ts"] },
    { step: "External audit anchor", why: "Anchor audit checkpoints in an external transparency service (SCITT), so completeness no longer depends on the verifier's memory.", where: ["src/lib/audit/checkpoint.ts"] },
    { step: "Peppol ordering", why: "Order and order-response documents for customers that already trade over Peppol; the response codes are already in the receipt.", where: ["src/lib/orders/receipt.ts"] },
  ];
}

export const LINKS = [
  { label: "Guided walkthrough", href: "/buyer?tour=1", note: "Plays the order, approval, exception and log steps in the running product" },
  { label: "Buyer side", href: "/buyer", note: "Today, orders, mandate and log for the buyer's purchasing lead" },
  { label: "Valio Aimo side", href: "/valio", note: "Connected agents, demand, unmet requests, audit" },
  { label: "Connect an agent", href: "/connect", note: "MCP and REST set-up for common agent applications" },
  { label: "OpenAPI 3.1", href: "/api/v1/openapi.json", note: "Every REST operation, with schemas and examples" },
  { label: "llms.txt", href: "/llms.txt", note: "Plain-text guide an agent can follow to buy" },
  { label: "JWKS", href: "/.well-known/jwks.json", note: "Public keys of the buyer, supplier and approver roles" },
  { label: "Audit verification", href: "/api/v1/audit/verify", note: "Live check of the hash chain and every signature" },
  { label: "Evidence as JSON", href: "/evidence.json", note: "This page's data, machine-readable" },
];
