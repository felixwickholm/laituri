import type { Check, Mandate, Offer, Product, RuleId } from "@/lib/contracts";

export interface EvaluateInput {
  mandate: { valid: boolean; mandate?: Mandate; reason?: string };
  offer: { valid: boolean; offer?: Offer; reason?: string };
  products: Map<string, Product>;
  agentId: string;
  /** Net EUR of orders already confirmed this ISO week, excluding this order. */
  weekSpendNet: number;
  orderedProductIds: Set<string>;
  now: Date;
}

export type Base = Omit<EvaluateInput, "mandate" | "offer"> & { input: EvaluateInput };

export type FullContext = Base & { mandate: Mandate; offer: Offer };
export type MandateContext = Base & { mandate: Mandate; offer?: Offer };
export type OfferContext = Base & { offer: Offer };

/** What a rule needs before it can run. Missing inputs turn the check into a block. */
export type Rule =
  | { id: RuleId; needs: "nothing"; run: (ctx: Base) => Check }
  | { id: RuleId; needs: "mandate"; run: (ctx: MandateContext) => Check }
  | { id: RuleId; needs: "offer"; run: (ctx: OfferContext) => Check }
  | { id: RuleId; needs: "both"; run: (ctx: FullContext) => Check };
