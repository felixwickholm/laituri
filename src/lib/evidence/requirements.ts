import type { Facts, Requirement, Scenario } from "./types";

/** "Core – your solution must enable", in the brief's order and words. */
export function core(f: Facts): Requirement[] {
  return [
    {
      quote: "Product, price & availability lookup: a structured way for an external agent to search for and retrieve what's available and at what price.",
      status: "covered",
      answer: `search_catalog and get_product (MCP), POST /api/v1/products/search and GET /api/v1/products/{id} (REST). Hits carry an indicative live price, stock, delivery date and order cut-off, plus pack maths for the stated need. ${f.mcpTools} MCP tools in all.`,
      where: ["src/lib/catalog/search.ts", "src/lib/gateway/preview.ts", "src/lib/mcp/tools.ts"],
      check: [{ kind: "eval", value: "O6" }, { kind: "url", value: "/api/v1/openapi.json" }],
    },
    {
      quote: "Requesting price & availability, then placing an order: a defined interaction for moving from inquiry to commitment, based on fixed prices rather than a negotiated quote.",
      status: "covered",
      answer: "request_quote returns an offer signed by the wholesaler key with a fixed net price, valid 15 minutes. place_order takes that offer unchanged plus the signed mandate and an idempotency key. One offer gives one order. Over REST the answer says the outcome: 201 confirmed, 202 waiting for a person, 422 blocked with the blocked order in the problem body.",
      where: ["src/lib/offers/quote.ts", "src/lib/offers/assemble.ts", "src/lib/orders/place.ts"],
      check: [{ kind: "eval", value: "1" }, { kind: "eval", value: "G1" }, { kind: "eval", value: "G9" }],
    },
    {
      quote: "Permission & human-approval management: what the agent may decide on its own, and what must go to a human for sign-off.",
      status: "covered",
      answer: `A buyer-signed mandate with ${f.mandateRules} rules in three tiers (alone, ask a person, never). Orders in the ask tier wait for the named approver, whose decision is signed with the approver key.`,
      where: ["src/lib/policy/evaluate.ts", "src/lib/mandate/defaults.ts", "src/lib/orders/approval.ts", "src/app/approve/[orderId]/page.tsx"],
      check: [{ kind: "eval", value: "4" }, { kind: "eval", value: "G10" }, { kind: "url", value: "/buyer/mandate" }],
    },
  ];
}

/** "Optional – open directions (not required to win)". */
export function optional(): Requirement[] {
  return [
    {
      quote: "Delivery time & sustainability comparison: not just price, but delivery reliability and the certificates/sustainability labels already shown in the webshop. (Category-level carbon-footprint ranges are a stretch goal.)",
      status: "covered",
      answer: "Every search hit and every signed offer line carries country of origin, labels, delivery reliability (0 to 1) and the category-average CO2 per kg. Search ranks a clear match by price, reliability or sustainability. The CO2 figure is a category average, not a range and not a product measurement.",
      where: ["src/lib/contracts/facts.ts", "src/lib/catalog/facts.ts", "src/lib/gateway/ranking.ts"],
      check: [{ kind: "eval", value: "T14" }, { kind: "test", value: "tests/offers/facts.test.ts" }],
    },
    {
      quote: "Substitution and other exception handling: what happens when the exact request can't be met.",
      status: "covered",
      answer: "Short stock, a passed order cut-off and late delivery each return signed alternatives with a tier (good, better, best), the tier's meaning and the trade-off in one sentence. The mandate decides whether a substitute may be taken alone.",
      where: ["src/lib/offers/alternatives.ts", "src/lib/policy/rules/fulfilment.ts"],
      check: [{ kind: "eval", value: "5" }, { kind: "eval", value: "6" }],
    },
    {
      quote: "Traceability and explainability: a human-readable record of what the agent did and why.",
      status: "covered",
      answer: "Each step appends a signed entry with a one-sentence summary to a hash chain. Each order lists every rule with its result and reason. The agent's runs show each tool call in plain words.",
      where: ["src/lib/audit/chain.ts", "src/lib/orders/summaries.ts", "src/components/agent/RunBlock.tsx", "src/app/buyer/log/page.tsx"],
      check: [{ kind: "eval", value: "T6" }, { kind: "url", value: "/buyer/log" }],
    },
  ];
}

/** "Problems we'd love to see tackled". */
export function problems(f: Facts): Requirement[] {
  return [
    {
      quote: "Trust protocol: the minimum data/verification standard for an external agent to trust Valio Aimo's claims on stock, price and origin without a manual check.",
      status: "covered",
      answer: "Price, stock, delivery date, order cut-off, origin and labels are inside one offer signed with ES256; the public keys are at /.well-known/jwks.json; the offer expires after 15 minutes and gives one order. docs/trust-protocol.md lists the verification steps.",
      where: ["docs/trust-protocol.md", "src/lib/contracts/offer.ts", "src/lib/trust/jws.ts", "src/lib/discovery/jwks.ts"],
      check: [{ kind: "eval", value: "T2" }, { kind: "eval", value: "T14" }, { kind: "url", value: "/.well-known/jwks.json" }],
    },
    {
      quote: "Guardrails model: which decisions require human sign-off (spend threshold, substitutions outside stated preferences) vs. fully autonomous.",
      status: "covered",
      answer: `Spend per order and per week, category, allergens and claims, substitution policy and price cap, partial and late delivery, match confidence and first-time products: ${f.mandateRules} rules, each with a defined tier.`,
      where: ["src/lib/policy/rules/spend.ts", "src/lib/policy/rules/fulfilment.ts", "src/lib/policy/rules/products.ts", "src/lib/policy/rules/trust.ts"],
      check: [{ kind: "command", value: "npm run eval -- --suite guardrails" }, { kind: "test", value: "tests/policy/evaluate.test.ts" }],
    },
    {
      quote: "Response logic: how an agent handles partial availability and substitution ranking (\"good-better-best\") within Valio Aimo's own assortment.",
      status: "covered",
      answer: "good is the cheapest like-for-like product that covers the need on time; better keeps what is in stock and fills the rest, or takes the most reliable product; best is an organic or Finnish-label product. Each meaning is returned with the alternative.",
      where: ["src/lib/offers/alternatives.ts", "src/components/order/Alternatives.tsx"],
      check: [{ kind: "eval", value: "5" }, { kind: "test", value: "tests/offers/quote.test.ts" }],
    },
    {
      quote: "Audit trail: a usable, human-readable log of an agent's purchasing decisions, for both buyer and Valio Aimo.",
      status: "covered",
      answer: "One signed hash chain, read by the buyer at /buyer/log and by the wholesaler at /valio/audit (filter by buyer, export as JSON). Anyone can verify it with the published keys.",
      where: ["src/app/buyer/log/page.tsx", "src/app/valio/audit/page.tsx", "src/lib/audit/verify.ts", "src/lib/console/verify.ts"],
      check: [{ kind: "eval", value: "T6" }, { kind: "eval", value: "T10" }, { kind: "url", value: "/valio/audit" }],
    },
  ];
}

/** The brief's question ends "without exposing real systems, confidential data or the marketplace roadmap". */
export function privacy(): Requirement[] {
  return [
    {
      quote: "Real systems",
      status: "covered",
      answer: "The upstream API key and address stay on the server. Agents call Laituri's own routes; upstream answers are normalised into Laituri's contracts before anything is returned.",
      where: ["src/lib/valio/http.ts", "src/lib/valio/normalise.ts"],
      check: [{ kind: "url", value: "/api/v1/openapi.json" }],
    },
    {
      quote: "Confidential data",
      status: "partly",
      answer: "Agents receive only the fields defined in the published schemas; the MCP server parses every tool result against its output schema, which drops any other field, and a result that does not parse is withheld and answered as a tool error. For an agent token, orders, offers, the mandate and approvals are scoped to its own buyer. The audit log is one public chain whose entries carry summaries with other buyers' products, quantities and prices (see Public audit log under Simulated, assumed and not built).",
      where: ["src/lib/contracts", "src/lib/mcp/server.ts", "src/lib/http/buyer-scope.ts", "src/app/api/v1/offers/[id]/route.ts"],
      check: [{ kind: "eval", value: "O6" }, { kind: "eval", value: "G21" }, { kind: "test", value: "tests/buyers/isolation.test.ts" }, { kind: "test", value: "tests/mcp/output-validation.test.ts" }],
    },
    {
      quote: "The buyer's terms",
      status: "covered",
      answer: "The wholesaler's overview counts which mandate rule held or stopped an order and its tier, never the limits or values behind it.",
      where: ["src/lib/insights/rules.ts", "src/lib/contracts/supplier.ts"],
      check: [{ kind: "test", value: "tests/insights/insights.test.ts" }],
    },
    {
      quote: "The marketplace roadmap",
      status: "covered",
      answer: "Nothing in the interface depends on a marketplace: it exposes today's catalogue, price, availability and ordering only. All data is the challenge's synthetic data.",
      where: ["src/lib/openapi/registry.ts", "fixtures/upstream"],
      check: [{ kind: "url", value: "/api/v1/openapi.json" }],
    },
  ];
}

/** "Example scenarios to spark ideas", with an honest status. */
export function scenarios(): Scenario[] {
  return [
    {
      name: "Need → recipe → order",
      quote: "a chef plans next week's menu around a seasonal ingredient. The agent suggests recipes, works out what's missing from stock, and places the order.",
      status: "not built",
      note: "No recipe model and no kitchen stock data. The ordering step at the end is what Laituri provides.",
      where: [],
      check: [],
    },
    {
      name: "Last-minute event",
      quote: "an unexpected booking for tomorrow. The agent identifies what the recipes require, flags what can't be sourced in time, and proposes substitutions through recipe logic rather than a simple SKU swap.",
      status: "partly",
      note: "\"By tomorrow\" requests, passed order cut-offs and late dates are flagged with signed on-time alternatives. No recipe logic: alternatives are like for like.",
      where: ["src/lib/policy/rules/fulfilment.ts", "src/lib/offers/alternatives.ts"],
      check: [{ kind: "eval", value: "6" }, { kind: "eval", value: "13" }],
    },
    {
      name: "Supplier stock-out",
      quote: "a key product runs out mid-week. The agent proposes a recipe-compatible substitute before the kitchen notices the gap, and explains the trade-off.",
      status: "partly",
      note: "Short stock returns a signed split or substitute with a one-sentence trade-off. It answers at quote time, not before the kitchen asks, and substitutes are like for like rather than recipe-compatible.",
      where: ["src/lib/offers/alternatives.ts"],
      check: [{ kind: "eval", value: "5" }],
    },
    {
      name: "Proactive selling agent",
      quote: "Valio Aimo's own agent spots a new or seasonal product and proactively suggests it to the buyer's agent.",
      status: "not built",
      note: "The wholesaler side shows unmet demand (what agents asked for and could not get), which such an agent would start from. Nothing is pushed to buyers' agents.",
      where: ["src/lib/insights/requests.ts", "src/app/valio/demand/page.tsx"],
      check: [{ kind: "url", value: "/valio/demand" }],
    },
    {
      name: "Allergen-safe substitution under pressure",
      quote: "in a school or hospital kitchen, a substitution must still satisfy strict allergen and nutrition rules.",
      status: "partly",
      note: "The school kitchens' mandate excludes peanut, nuts and sesame, also as traces, and every line, substitutes included, is checked. Missing allergen data blocks the line. Nutrition rules are not modelled.",
      where: ["src/lib/policy/rules/products.ts", "src/lib/mandate/defaults.ts"],
      check: [{ kind: "eval", value: "9b" }, { kind: "test", value: "tests/demo/two-kitchens.test.ts" }],
    },
    {
      name: "Standing order drift detection",
      quote: "the agent learns a kitchen's recurring weekly order and flags anomalies (portion counts creeping up, cost drifting) before auto-renewing it.",
      status: "not built",
      note: "No standing orders. The nearest control is the weekly spend limit and the rule that sends a first-time product to a person.",
      where: ["src/lib/policy/rules/spend.ts"],
      check: [{ kind: "eval", value: "14" }, { kind: "eval", value: "18" }],
    },
  ];
}
