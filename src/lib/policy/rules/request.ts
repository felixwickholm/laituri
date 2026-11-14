import type { Rule } from "../context";
import { check } from "../format";

export const NO_WORDS_REASON = "The agent did not state what the buyer asked for, so the offer could not be checked against it.";

/**
 * An offer quoted without the buyer's words carries no request check, so nothing shows it is what the buyer asked
 * for. Under a mandate that requires the words, a person decides such an order.
 */
export const requestWords: Rule = {
  id: "request.words",
  needs: "both",
  run: ({ mandate, offer }) => {
    const required = mandate.approval.requireRequestWords;
    const limit = required ? "the buyer's words with every quote" : "not required";
    if (offer.requestCheck?.length) {
      return check("request.words", "pass", "The offer was checked against the buyer's words.", { observed: "words sent", limit });
    }
    if (!required) return check("request.words", "pass", "The mandate does not require the buyer's words.", { observed: "no words", limit });
    return check("request.words", "ask", NO_WORDS_REASON, { observed: "no words", limit });
  },
};
