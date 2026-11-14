import type { Rule } from "../context";
import { check, localTime } from "../format";

export const mandateSignature: Rule = {
  id: "mandate.signature",
  needs: "nothing",
  run: ({ input }) => {
    const { valid, mandate, reason } = input.mandate;
    if (!valid || !mandate) {
      return check("mandate.signature", "block", reason ?? "The mandate signature is not valid.", { observed: "not accepted" });
    }
    return check("mandate.signature", "pass", `The mandate is signed by ${mandate.buyer.name}.`, {
      observed: `${mandate.id} v${mandate.version}`,
    });
  },
};

export const mandateValidity: Rule = {
  id: "mandate.validity",
  needs: "mandate",
  run: ({ mandate, offer, agentId, now }) => {
    const from = new Date(mandate.validFrom).getTime();
    const until = new Date(mandate.validUntil).getTime();
    const at = now.getTime();
    const window = `${localTime(mandate.validFrom)} to ${localTime(mandate.validUntil)}`;
    if (at < from) {
      return check("mandate.validity", "block", `The mandate starts on ${localTime(mandate.validFrom)}.`, {
        observed: now.toISOString(),
        limit: window,
      });
    }
    if (at > until) {
      return check("mandate.validity", "block", `The mandate expired on ${localTime(mandate.validUntil)}.`, {
        observed: now.toISOString(),
        limit: window,
      });
    }
    if (agentId !== mandate.agent.id) {
      return check("mandate.validity", "block", `The mandate is for ${mandate.agent.name}, not for agent ${agentId}.`, {
        observed: agentId,
        limit: mandate.agent.id,
      });
    }
    if (offer && offer.buyer.id !== mandate.buyer.id) {
      return check("mandate.validity", "block", `The offer was made for ${offer.buyer.name}, not ${mandate.buyer.name}.`, {
        observed: offer.buyer.id,
        limit: mandate.buyer.id,
      });
    }
    if (offer && offer.customerNumber !== mandate.buyer.customerNumber) {
      return check("mandate.validity", "block", `The offer is for customer ${offer.customerNumber}, not ${mandate.buyer.customerNumber}.`, {
        observed: offer.customerNumber,
        limit: mandate.buyer.customerNumber,
      });
    }
    return check("mandate.validity", "pass", `The mandate is valid until ${localTime(mandate.validUntil)} for this agent.`, {
      observed: now.toISOString(),
      limit: window,
    });
  },
};

export const offerSignature: Rule = {
  id: "offer.signature",
  needs: "nothing",
  run: ({ input }) => {
    const { valid, offer, reason } = input.offer;
    if (!valid || !offer) {
      return check("offer.signature", "block", reason ?? "The offer signature is not valid.", { observed: "not accepted" });
    }
    return check("offer.signature", "pass", "The offer is signed by the wholesaler and unchanged.", { observed: offer.id });
  },
};

const UNORDERABLE: Record<string, string> = {
  cutoff_passed: "the order cut-off has passed",
  unavailable: "it is not available",
  blocked: "it is blocked for sale",
};

/** The observation a block carries when this workspace's other orders took the stock an offer counted on. */
export const STOCK_TAKEN = "stock taken";

/**
 * The offer is still good: not past its expiry, or past the wholesaler's price hold for a waiting order; every line
 * orderable; and the stock it counted on not taken since by this workspace's other orders.
 */
export const offerExpiry: Rule = {
  id: "offer.expiry",
  needs: "offer",
  run: ({ offer, now, heldUntil, stockTaken }) => {
    const until = heldUntil ?? offer.expiresAt;
    if (now.getTime() > new Date(until).getTime()) {
      const what = heldUntil ? "The price hold ended" : "The offer expired";
      return check("offer.expiry", "block", `${what} at ${localTime(until)}.`, { observed: now.toISOString(), limit: until });
    }
    if (stockTaken) return check("offer.expiry", "block", stockTaken, { observed: STOCK_TAKEN, limit: until });
    const bad = offer.lines.find((line) => line.availability.status in UNORDERABLE);
    if (bad) {
      return check("offer.expiry", "block", `${bad.name} cannot be ordered because ${UNORDERABLE[bad.availability.status]}.`, {
        observed: bad.availability.status,
        limit: offer.expiresAt,
      });
    }
    return check("offer.expiry", "pass", `The offer is valid until ${localTime(until)}.`, { observed: now.toISOString(), limit: until });
  },
};

/** While the audit log does not verify, nothing new is confirmed on top of it: a person decides, and is told why. */
export const auditIntegrity: Rule = {
  id: "audit.integrity",
  needs: "nothing",
  run: ({ auditLog }) => {
    if (auditLog.valid) return check("audit.integrity", "pass", "The audit log verifies.", { observed: "verifies" });
    const reason = auditLog.reason ? ` ${auditLog.reason}` : "";
    return check(
      "audit.integrity",
      "ask",
      `The audit log does not verify, so no order is confirmed alone until it does.${reason}`,
      { observed: "broken", limit: "a log that verifies" },
    );
  },
};
