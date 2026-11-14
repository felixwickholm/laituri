import { suite } from "./facts";
import type { Facts, Question } from "./types";

/**
 * Questions a reviewer asks first, answered in two or three sentences each. Rendered in docs/paper.md and on /paper,
 * and published there as schema.org FAQPage data with the same text, so the visible page and the data never differ.
 */
export function questions(f: Facts): Question[] {
  const guardrails = suite(f, "guardrails");
  const trust = suite(f, "trust");
  return [
    {
      question: "Are the orders real?",
      answer:
        "No. The challenge's mock API has price and availability but no order endpoint, so Laituri writes the order and its signed receipt itself and marks every order simulated: true. Prices and stock come from the mock API in live mode, or from recorded answers in tests and evals.",
    },
    {
      question: "Can the purchasing agent approve its own order or raise its own limit?",
      answer: `No. Only the buyer key signs a mandate and only the approver key signs an approval; an agent credential cannot reach either path over REST or MCP. The guardrails eval suite tries this and other attacks: ${guardrails.passed} of ${guardrails.total} cases pass.`,
    },
    {
      question: "How does the agent decide what it may buy alone?",
      answer: `The buyer-signed mandate has ${f.mandateRules} rules in three tiers: alone, ask a person, never. Spend limits, allowed categories, allergens, a never-buy list, substitution policy, delivery and the buyer's own words are checked on every order. When the buyer turns on the history rule, a product bought before is reordered alone inside the limits and a product never ordered before waits for a person.`,
    },
    {
      question: "What happens when the product is short, late or past its order cut-off?",
      answer:
        "The wholesaler returns signed counter-offers ranked good, better and best, each with its trade-off in one sentence, and the mandate decides whether the agent may take one alone. In a menu plan, a missing ingredient is swapped by its role in the recipe, with the reason stated.",
    },
    {
      question: "How can I check a claim without trusting the server?",
      answer: `Fetch the public keys from /.well-known/jwks.json and verify any offer, mandate, approval, receipt or log entry yourself (ES256 JWS). GET /api/v1/audit/verify re-checks the whole hash chain, and the trust eval suite changes, deletes, reorders and cuts entries to show each is detected: ${trust.passed} of ${trust.total} cases pass.`,
    },
    {
      question: "Which open standards does it use?",
      answer:
        "Model Context Protocol over Streamable HTTP and REST described by OpenAPI 3.1, both generated from one set of zod schemas; JWS and JWKS for signatures; RFC 9457 problem details for errors; GS1 GTIN for products. AP2 mandates, UCP terms and Peppol order-response codes are followed in names and shapes.",
    },
    {
      question: "How do I try it as an agent?",
      answer:
        "POST /api/v1/workspace with no credential returns a private sandbox with one agent key per demo buyer and its MCP address. /llms.txt then gives the REST flow as curl lines: search, quote, read the mandate, order.",
    },
  ];
}
