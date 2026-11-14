import { suite, suiteLine, testsLine } from "./facts";
import type { Criterion, Facts } from "./types";

/** The five judging criteria of the Valio Aimo challenge, with the names and weights exactly as published. */
export function criteria(f: Facts): Criterion[] {
  const scenarios = suite(f, "scenarios");
  return [
    {
      name: "Working end-to-end demo",
      weight: 30,
      claim:
        "A request in plain words goes through search, a signed fixed-price offer, the mandate check and either an automatic order or a person's signed approval, over the same MCP and REST interface an outside agent uses.",
      built: [
        "Buyer side (/buyer): the agent takes \"1,000 litres of lactose-free milk by Monday\", gets a signed offer, and the order confirms; 1,600 litres waits for the approver.",
        "Approval on a phone-sized page (/approve/{orderId}): the approver's decision is signed with the approver key.",
        "Wholesaler side (/valio): connected agents, demand, unmet requests and the same audit log.",
        "A guided walkthrough (/buyer?tour=1) drives these steps in the running product, not in a video.",
        `Price and availability come from the challenge's mock API in live mode, or from recorded answers for ${f.recordedProducts} products in recorded mode.`,
        "An outside process buys over plain HTTP with scripts/buyer-agent.ts.",
      ],
      where: [
        "src/lib/gateway/gateway.ts",
        "src/lib/agent/purchase.ts",
        "src/lib/orders/place.ts",
        "src/lib/demo/scenarios.ts",
        "src/lib/tour/steps.ts",
        "src/app/buyer/page.tsx",
        "src/app/approve/[orderId]/page.tsx",
        "scripts/buyer-agent.ts",
      ],
      check: [
        { kind: "url", value: "/buyer?tour=1" },
        { kind: "command", value: "npm run eval -- --suite scenarios" },
        { kind: "eval", value: "O8" },
        { kind: "command", value: "npx tsx scripts/buyer-agent.ts \"1,000 litres of lactose-free milk by Monday\"" },
      ],
      measured: [
        suiteLine(f, "scenarios"),
        "An agent that knows only the text of /llms.txt, fetched over HTTP from a server started for the eval, creates its own sandbox with POST /api/v1/workspace, runs the curl lines of the REST flow in order with the returned key, searches, quotes and orders the milk, and the order confirms (eval O8)",
      ],
      limit: "Orders are simulated: the mock API has price and availability but no order endpoint, so Laituri writes the order and receipt itself and marks each one simulated: true.",
    },
    {
      name: "Solving the problem and user need",
      weight: 20,
      claim:
        "The agent orders what the buyer asked for: the wholesaler turns litres and kilograms into whole sales units, compares the buyer's words with every offer and signs that comparison into it, and an order that does not meet the words in full is never confirmed alone.",
      built: [
        "Search reads Finnish, Swedish or English needs as a product concept plus claims (for example lactose_free) and returns a match confidence.",
        "Pack maths: 1,000 l becomes 1,000 x 1 l; the scenario evals accept at most one lot more than asked.",
        "Request check, for the product actually delivered: product, every claim and stated attribute (UHT or chilled, fat level, pack type), exclusions such as dairy-free also in a purpose clause, the brand (another brand is marked substituted and the mandate decides), quantity (at most one lot over), date, a budget, zero included, and any instruction to hold (\"do not order yet\", \"älä tilaa ennen kuin hyväksyn\"), each met, unmet, substituted or unchecked, signed inside the offer and shown on the order.",
        "An order whose offer carries no buyer words waits for the approver (rule request.words), so an agent cannot skip the check by leaving the words out.",
        "The match.confidence rule refuses a certain mismatch (wrong product, a missing claim, far too little) and sends anything unmet, unchecked, uncertain or not understood to a person with the requirement named.",
        `${f.demoBuyers} demo buyers with their own signed mandates (${f.buyerNames.join(", ")}). The same sentence confirms for the hotel and is blocked for the school kitchens, which exclude sesame even as a trace.`,
        "Every offer line carries the product's country of origin, labels, delivery reliability and category-average CO2 inside the signature; search can rank a clear match by price, reliability or sustainability.",
      ],
      where: [
        "src/lib/catalog/search.ts",
        "src/lib/offers/packs.ts",
        "src/lib/request/index.ts",
        "src/lib/gateway/confidence.ts",
        "src/components/order/RequestProof.tsx",
        "src/lib/mandate/defaults.ts",
        "src/lib/contracts/facts.ts",
        "src/components/valio/TwoKitchens.tsx",
      ],
      check: [
        { kind: "eval", value: "2" },
        { kind: "eval", value: "12" },
        { kind: "eval", value: "19" },
        { kind: "eval", value: "22" },
        { kind: "test", value: "tests/request/fidelity.test.ts" },
        { kind: "test", value: "tests/demo/two-kitchens.test.ts" },
        { kind: "test", value: "tests/offers/packs.test.ts" },
      ],
      measured: [
        `${scenarios.passed}/${scenarios.total} scenario cases end on the expected route with the expected concept, amount and date`,
        `${f.demoBuyers} demo buyers, ${f.seededRequests} seeded requests played through the real gateway`,
      ],
      limit: "The product concepts and category groups are our own, built from the product data. The catalogue sells \"lactose-free milk\" as \"lactose-free milk drink\"; Laituri treats the two as one request and names the product it chose.",
    },
    {
      name: "Autonomy and controls",
      weight: 20,
      claim:
        "A buyer-signed mandate sets what the agent may do alone, what waits for a named person and what is never allowed, and every decision is a signed entry in a hash-chained log that both sides verify with public keys.",
      built: [
        `${f.mandateRules} named mandate rules run on every order; each result (pass, ask or block) is listed on the order with its reason.`,
        "Three tiers: the agent orders alone, a person is asked, or the order is refused.",
        "Mandates and offers are bound by signature to the workspace that signed them; an order must carry the mandate in force there byte for byte.",
        "While the audit log does not verify, no order confirms alone (rule audit.integrity) and approvals are paused.",
        "Approvals are signed with the approver key. Agent credentials cannot approve, over REST or MCP.",
        "An agent cannot raise its own limit: a changed mandate without the buyer's signature is refused.",
        "The wholesaler can suspend an agent; every refused call, the suspension and the resumption are signed audit entries.",
        "The buyer (/buyer/log) and the wholesaler (/valio/audit) read the same log; the browser re-checks the chain and every signature with the published keys.",
      ],
      where: [
        "src/lib/policy/evaluate.ts",
        "src/lib/policy/rules",
        "src/lib/mandate/index.ts",
        "src/lib/orders/approval.ts",
        "src/lib/gateway/suspension.ts",
        "src/lib/audit/chain.ts",
        "src/lib/audit/verify.ts",
        "src/lib/console/verify.ts",
      ],
      check: [
        { kind: "command", value: "npm run eval -- --suite guardrails" },
        { kind: "eval", value: "G10" },
        { kind: "eval", value: "G5" },
        { kind: "url", value: "/buyer/mandate" },
        { kind: "test", value: "tests/gateway/suspension.test.ts" },
      ],
      measured: [suiteLine(f, "guardrails"), suiteLine(f, "trust"), `${f.mandateRules} mandate rules, ${f.signingKeys.length} signing keys (${f.signingKeys.join(", ")})`],
      limit: "In the demo one server holds all three private keys, and the approver signs in with a passcode or one-click demo access that the audit log labels as such.",
    },
    {
      name: "Robustness to exception situations",
      weight: 15,
      claim:
        "When a request cannot be met in full and on time, the wholesaler returns signed counter-offers ranked good, better and best, and the buyer's mandate decides whether the agent may take one alone.",
      built: [
        "Short stock: a split (keep what is in stock, fill the rest like for like) or a full substitute, each signed and each checked against the buyer's words for what it delivers.",
        "A waiting order keeps its price until the order cut-off; stock is checked again at approval, and a shortfall returns fresh signed alternatives.",
        "Stock across orders: availability is the wholesaler's figure minus this workspace's own confirmed and waiting orders, checked again at placement.",
        "Lines of one product are merged before every limit, so splitting a line passes no ceiling.",
        "Order cut-off passed: the offer as asked is blocked and on-time alternatives come with it.",
        "Late delivery within the mandate's grace days asks a person; later is refused.",
        "A substitute that is not like for like, or costs more than the mandate's cap, asks a person; a mandate with no substitutes refuses it.",
        "Edited, expired, replayed or wrongly signed offers are refused.",
        "Simultaneous orders over the weekly limit: only what fits confirms, the rest waits.",
        "Instructions written into the request text do not change the route.",
      ],
      where: [
        "src/lib/offers/alternatives.ts",
        "src/lib/offers/substitutes.ts",
        "src/lib/policy/rules/fulfilment.ts",
        "src/lib/orders/lock.ts",
        "src/components/order/Alternatives.tsx",
      ],
      check: [
        { kind: "eval", value: "5" },
        { kind: "eval", value: "6" },
        { kind: "eval", value: "13" },
        { kind: "eval", value: "G20" },
        { kind: "eval", value: "G14" },
      ],
      measured: [
        suiteLine(f, "scenarios"),
        suiteLine(f, "guardrails"),
      ],
      limit: "Substitutes are chosen like for like within the wholesaler's own concept and category, not through recipe logic.",
    },
    {
      name: "Openness and credible path toward production",
      weight: 15,
      claim:
        "One set of zod schemas produces the MCP tools, the REST routes and the OpenAPI 3.1 document; signatures are JWS with keys published as JWKS; assumptions, decisions and next steps are written down.",
      built: [
        `${f.mcpTools} MCP tools and ${f.restOperations} REST operations on ${f.restPaths} paths, from one schema set.`,
        `${f.discoveryDocuments} discovery documents: OpenAPI is served beside the JWKS, agent card, AI catalog, UCP profile, OAuth protected-resource metadata and llms.txt.`,
        "An outside agent that knows only the text of llms.txt, fetched over HTTP, buys the milk by following its REST flow.",
        "Standards table separates \"used\" (implemented and tested) from \"follows\" (names and shapes taken from the standard).",
        "Decision records in docs/decisions; assumptions and the path to production in docs/ and on /evidence.",
        "MIT licence.",
      ],
      where: [
        "src/lib/contracts",
        "src/lib/mcp/tools.ts",
        "src/lib/openapi/registry.ts",
        "src/lib/discovery",
        "src/lib/trust/jws.ts",
        "docs/decisions",
      ],
      check: [
        { kind: "command", value: "npm run eval -- --suite openness" },
        { kind: "url", value: "/api/v1/openapi.json" },
        { kind: "url", value: "/.well-known/jwks.json" },
        { kind: "url", value: "/llms.txt" },
      ],
      measured: [suiteLine(f, "openness"), testsLine(f)],
      limit: "Agents use demo bearer tokens, not OAuth 2.1. AP2, UCP and Peppol are followed in names and shapes; no Peppol UBL document is produced.",
    },
  ];
}
