import type { Refusal } from "@/lib/contracts";

/** Refusals of an order as invalid, worded apart from any mandate rule that blocks an order. */
export const REFUSALS = {
  offerSignature: { code: "invalid_signature", message: "Refused: the offer's signature did not verify." },
  mandateSignature: { code: "invalid_signature", message: "Refused: the mandate's signature did not verify." },
  offerElsewhere: { code: "not_issued_here", message: "Refused: the offer was not issued in this workspace." },
  mandateElsewhere: { code: "not_issued_here", message: "Refused: the mandate is not the one in force in this workspace." },
} as const satisfies Record<string, Refusal>;
