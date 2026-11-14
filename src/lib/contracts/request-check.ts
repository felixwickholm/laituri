import { z } from "zod";

/** What in the buyer's words an offer is compared with. */
export const RequestRequirement = z.enum(["product", "claim", "quantity", "date", "budget", "approval", "wording"]);
export type RequestRequirement = z.infer<typeof RequestRequirement>;

/** met: the offer does what the words ask. unmet: it does not. unchecked: the words cannot be compared with the offer. */
export const RequestCheckResult = z.enum(["met", "unmet", "unchecked"]);
export type RequestCheckResult = z.infer<typeof RequestCheckResult>;

/** One requirement in the buyer's words, compared by the wholesaler with one offer. */
export const RequestCheck = z.object({
  requirement: RequestRequirement,
  asked: z.string().describe("The requirement as the buyer's words state it"),
  offered: z.string().describe("What the offer gives for it"),
  result: RequestCheckResult,
  certain: z.boolean().describe("True when the offer certainly fails the words (wrong product, a missing claim, far too little); the order is then refused, not sent to a person"),
});
export type RequestCheck = z.infer<typeof RequestCheck>;
