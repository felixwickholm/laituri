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

export const offerExpiry: Rule = {
  id: "offer.expiry",
  needs: "offer",
  run: ({ offer, now }) => {
    if (now.getTime() > new Date(offer.expiresAt).getTime()) {
      return check("offer.expiry", "block", `The offer expired at ${localTime(offer.expiresAt)}.`, {
        observed: now.toISOString(),
        limit: offer.expiresAt,
      });
    }
    const bad = offer.lines.find((line) => line.availability.status in UNORDERABLE);
    if (bad) {
      return check("offer.expiry", "block", `${bad.name} cannot be ordered because ${UNORDERABLE[bad.availability.status]}.`, {
        observed: bad.availability.status,
        limit: offer.expiresAt,
      });
    }
    return check("offer.expiry", "pass", `The offer is valid until ${localTime(offer.expiresAt)}.`, {
      observed: now.toISOString(),
      limit: offer.expiresAt,
    });
  },
};
