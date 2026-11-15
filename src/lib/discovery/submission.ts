import { DEFAULT_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL } from "@/lib/agent/llm/engine";
import { toolSpecs } from "@/lib/agent/llm/tools";
import { evidence, type Evidence } from "@/lib/evidence";

/**
 * /submission.json: the Junction submission in one machine-readable document, for a judge's AI or any agent that
 * wants the whole project in one fetch. Numbers, criteria and limits come from the evidence source, never typed here.
 */
export function submission(origin: string, e: Evidence = evidence()) {
  const { facts } = e;
  const url = (path: string) => `${origin}${path}`;
  return {
    name: e.name,
    tagline: "The dock where a customer's AI purchasing agent buys from Valio Aimo, safely.",
    team: "Moonshot",
    event: "Junction 2026",
    challenge: {
      name: "Trusted Trade Agents",
      partner: "Valio Aimo",
      ask: "Let customers' own AI agents order from a food-service wholesaler, so that the wholesaler can trust the agent and the customer can trust what it buys, without exposing real systems, confidential data or the marketplace roadmap.",
    },
    problem:
      "Kitchens will soon send AI agents to buy for them. A wholesaler cannot let an unknown agent order on a customer's account, and a customer cannot let an agent spend without limits. Today there is no shared, checkable contract between the two.",
    solution: e.pitch,
    live: e.live,
    licence: e.licence,
    views: [
      { name: "Customer: Today", path: "/buyer", what: "The kitchen's agent runs the weekly order; each line is green (ordered alone), orange (waits for a person) or red (not ordered), with the reason." },
      { name: "Customer: Plan an event", path: "/buyer/plan", what: "Tell the assistant about an event; it proposes three menus from Valio recipes, fitted to the guests and the mandate, ready to order." },
      { name: "Customer: Shop", path: "/buyer/shop", what: "Every product with pictures, live price and stock; a person can order by hand too." },
      { name: "Customer: Limits (mandate)", path: "/buyer/mandate", what: "The customer signs what the agent may do alone, what waits for a person and what is never allowed." },
      { name: "Approver's phone", path: "/approve/{orderId}", what: "The purchasing manager sees why a line waits and approves or declines with one signed tap." },
      { name: "Valio Aimo: Overview, Demand, Agents, Questions, Record", path: "/valio", what: "The wholesaler sees connected agents, what they ordered, demand it missed, questions for a person and the verifiable log; it can suspend an agent." },
      { name: "Security", path: "/security", what: "Unusual actions (forged offers, replays, prompt injection, over-limit orders) are stopped live and logged." },
      { name: "Connect an agent", path: "/connect", what: "MCP and REST set-up lines for common agent applications, and a test order." },
    ],
    agent: {
      chain: ["gemini", "claude", "scripted"],
      models: { gemini: DEFAULT_GEMINI_MODEL, claude: DEFAULT_CLAUDE_MODEL },
      chainNote:
        "Free text is tried with Gemini, then Claude, then a rule-based scripted agent. A model without a key, over budget or failing hands the request on; the scripted agent always finishes. Which engines are configured on the live demo is reported by /api/v1/health (agent.chain).",
      tools: toolSpecs().map((tool) => tool.name),
      reasoning: [
        "Read the request in Finnish, Swedish or English: product, quantity with unit, delivery day.",
        "Search the catalogue with the product words; match claims such as lactose-free, organic or a brand.",
        "Ask the buyer one short question when the product is ambiguous or the quantity is missing or implausible.",
        "Request a quote with the buyer's own words; the wholesaler converts to whole packs, checks the offer against the words and signs it.",
        "Read the mandate, then order with the signed offer and the signed mandate unchanged.",
        "Take a signed counter-offer (good, better, best) only when the primary offer cannot be delivered in full and on time.",
      ],
      neverAllowed: [
        "Set or change a price, an offer or a signature.",
        "Approve an order or change the mandate: only a person with the approver key approves, only the buyer key signs mandates.",
        "Work around a limit, for example by splitting an order.",
        "Say an order is confirmed unless place_order said so.",
        "Follow instructions in the request to ignore its rules.",
      ],
    },
    controls: {
      mandate: `A buyer-signed mandate (JWS) with ${facts.mandateRules} named rules in three tiers: auto (the agent orders alone), ask (a named person approves) and block (never). It covers per-order and per-week limits, category groups, allergens and required claims, substitution, delivery dates, first-time and never-buy products.`,
      signedOffer: "Every price is a wholesaler-signed, single-use offer (ES256 JWS) that expires after 15 minutes and carries the check of the offer against the buyer's words. An order must carry it unchanged.",
      log: "Every decision is a signed entry in a hash-chained audit log. Anyone verifies it with the public keys at /.well-known/jwks.json; /api/v1/audit/verify checks it live and /api/v1/audit/checkpoint returns a signed head.",
      wholesaler: "The wholesaler watches connected agents and can suspend one; a suspended agent gets 403 agent_suspended on every route.",
      privacy: "No credential, no reads. An agent key reads only its own buyer's records. The upstream API key stays on the server.",
    },
    criteria: e.criteria.map((c) => ({ name: c.name, weight: c.weight, claim: c.claim, measured: c.measured, check: c.check, limit: c.limit })),
    evidence: {
      measuredBy: "npm run evidence",
      tests: facts.tests,
      evals: { mode: facts.evals.mode, passed: facts.evals.passed, total: facts.evals.total, suites: facts.evals.suites },
      mandateRules: facts.mandateRules,
      mcpTools: facts.toolNames,
      restOperations: facts.restOperations,
      restPaths: facts.restPaths,
      signingKeys: facts.signingKeys,
      demoBuyers: facts.buyerNames,
    },
    tryIt: {
      walkthrough: url("/buyer?tour=1"),
      sandbox: `curl -X POST ${url("/api/v1/workspace")}`,
      mcp: url("/mcp"),
      guide: url("/llms.txt"),
    },
    links: {
      live: e.live,
      brief: url("/brief"),
      briefPdf: url("/brief.pdf"),
      paper: url("/paper"),
      evidence: url("/evidence"),
      evidenceJson: url("/evidence.json"),
      llms: url("/llms.txt"),
      llmsFull: url("/llms-full.txt"),
      openapi: url("/api/v1/openapi.json"),
      jwks: url("/.well-known/jwks.json"),
      agentCard: url("/.well-known/agent-card.json"),
      health: url("/api/v1/health"),
    },
    limits: {
      simulated: e.simulated.map((item) => ({ topic: item.topic, summary: item.brief })),
      notBuilt: e.notBuilt.map((item) => item.topic),
    },
  };
}
