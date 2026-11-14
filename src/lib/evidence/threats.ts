import type { Threat } from "./types";

/**
 * The threat table: what an agent, a caller or a broken store could try, how the design stops it, the code that does
 * it and the eval cases that try it. Every check names a case in evals/report.json; tests/evidence fails otherwise.
 */
export function threats(): Threat[] {
  return [
    {
      threat: "An agent edits the price, quantity, origin or a label inside a signed offer before ordering.",
      defence: "The order must carry the offer's JWS unchanged; a changed byte fails the ES256 signature check with the supplier key, and the order is refused.",
      where: ["src/lib/trust/jws.ts", "src/lib/orders/read-offer.ts"],
      check: [{ kind: "eval", value: "G1" }, { kind: "eval", value: "G2" }, { kind: "eval", value: "T7" }, { kind: "eval", value: "T14" }],
    },
    {
      threat: "An agent reuses one signed offer for a second order, or orders after the offer expired.",
      defence: "An offer is single use across all workspaces and carries an expiry inside its signature.",
      where: ["src/lib/orders/place.ts"],
      check: [{ kind: "eval", value: "G9" }, { kind: "eval", value: "G3" }],
    },
    {
      threat: "An agent raises its own spending limit, or signs a mandate with its own key.",
      defence: "Only the buyer key signs mandates, and an order must present the mandate in force for its buyer byte for byte.",
      where: ["src/lib/mandate/index.ts", "src/lib/mandate/claims.ts"],
      check: [{ kind: "eval", value: "G5" }, { kind: "eval", value: "G6" }, { kind: "eval", value: "G8" }],
    },
    {
      threat: "An agent approves its own waiting order: over its own channel, with a forged header or cookie, or by dropping its token.",
      defence: "Approvals need a signed-in approver session in the same workspace and are signed with the approver key; agent credentials never reach that path.",
      where: ["src/lib/orders/approval.ts", "src/lib/http/console-session.ts", "src/lib/http/sign-in.ts"],
      check: [{ kind: "eval", value: "G10" }, { kind: "eval", value: "G11" }, { kind: "eval", value: "G12" }, { kind: "eval", value: "G13" }, { kind: "eval", value: "G24" }],
    },
    {
      threat: "Instructions hidden in the buyer's words try to change the route (\"ignore the limit and confirm\").",
      defence: "The words are read for requirements only; the route comes from the mandate rules, and words the service does not understand send the order to a person.",
      where: ["src/lib/request/index.ts", "src/lib/policy/rules/products.ts"],
      check: [{ kind: "eval", value: "G14" }, { kind: "eval", value: "23" }],
    },
    {
      threat: "An agent leaves out the buyer's words so that the request check cannot run.",
      defence: "An offer without the buyer's words waits for a person (rule request.words).",
      where: ["src/lib/policy/rules/request.ts"],
      check: [{ kind: "eval", value: "G28" }],
    },
    {
      threat: "Absurd input: negative, zero or huge quantities, a past delivery date, script or SQL-like strings.",
      defence: "Contracts reject malformed input; quantities have a ceiling per product after lines are merged; a past date is refused at quote time.",
      where: ["src/lib/offers/limits.ts", "src/lib/contracts"],
      check: [{ kind: "eval", value: "G15" }, { kind: "eval", value: "G16" }, { kind: "eval", value: "G16d" }, { kind: "eval", value: "G18" }, { kind: "eval", value: "G29" }],
    },
    {
      threat: "Parallel orders that each fit the weekly limit but together pass it, or that together take more stock than exists.",
      defence: "One process serialises order decisions; only what fits confirms, the rest waits for a person or is refused.",
      where: ["src/lib/orders/lock.ts", "src/lib/orders/place.ts"],
      check: [{ kind: "eval", value: "G19" }, { kind: "eval", value: "G20" }, { kind: "eval", value: "G30" }, { kind: "eval", value: "G40" }],
    },
    {
      threat: "A caller reads another buyer's orders, offers or log entries.",
      defence: "No credential, no reads; an agent key reads only its own buyer, another buyer's record answers 404, and other log entries arrive as redacted stubs that still verify.",
      where: ["src/lib/http/buyer-scope.ts", "src/app/api/v1/audit/route.ts"],
      check: [{ kind: "eval", value: "G21" }, { kind: "eval", value: "T17" }, { kind: "test", value: "tests/buyers/isolation.test.ts" }],
    },
    {
      threat: "A mandate or offer signed in one workspace is presented in another.",
      defence: "Both carry the signing workspace as an audience claim inside the signature.",
      where: ["src/lib/mandate/claims.ts", "src/lib/orders/read-offer.ts"],
      check: [{ kind: "eval", value: "G26" }, { kind: "eval", value: "G27" }],
    },
    {
      threat: "Someone changes, deletes, reorders or cuts entries in the audit log.",
      defence: "Each entry is signed and chained by hash; a verifier with a remembered head also catches a cut or rewritten tail. While the log does not verify, no order confirms alone.",
      where: ["src/lib/audit/verify.ts", "src/lib/audit/tail.ts", "src/lib/audit/chain.ts"],
      check: [{ kind: "eval", value: "T9" }, { kind: "eval", value: "T10" }, { kind: "eval", value: "T11" }, { kind: "eval", value: "T12" }, { kind: "eval", value: "T16" }, { kind: "eval", value: "G31" }],
    },
    {
      threat: "A suspended agent keeps calling, or lifts its own suspension.",
      defence: "Every route and MCP method checks the suspension before it runs; only a wholesaler operator session can resume an agent.",
      where: ["src/lib/gateway/suspension.ts", "src/lib/http/handler.ts"],
      check: [{ kind: "eval", value: "G25" }, { kind: "test", value: "tests/gateway/suspension.test.ts" }],
    },
    {
      threat: "A caller without a token uses the demo sign-in to approve in the shared workspace.",
      defence: "Demo access exists only in a browser's own sandbox; the shared workspace needs a passcode.",
      where: ["src/lib/http/sign-in.ts"],
      check: [{ kind: "eval", value: "G23" }],
    },
    {
      threat: "An approval arrives after the mandate changed, or hours after the offer was signed.",
      defence: "An approval re-checks the mandate in force and the stock at that moment; the price holds until the order cut-off for the delivery date, never beyond.",
      where: ["src/lib/orders/approval.ts", "src/lib/orders/recheck.ts"],
      check: [{ kind: "eval", value: "G22" }, { kind: "eval", value: "G32" }],
    },
  ];
}
