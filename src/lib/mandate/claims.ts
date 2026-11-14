import { z } from "zod";
import { Mandate, Money } from "@/lib/contracts";
import { now } from "@/lib/clock";

/** Verifiable credential type of an AP2 v0.2 open checkout mandate. */
export const MANDATE_VCT = "mandate.checkout.open.1";

const Constraint = z.object({ type: z.string().startsWith("fi.valio.") }).loose();

/** JWT claims of a signed mandate. `mandate` carries the full object so the round trip is lossless. */
export const MandateClaims = z.object({
  vct: z.literal(MANDATE_VCT),
  iss: z.string(),
  sub: z.string(),
  aud: z.string(),
  iat: z.number().int(),
  nbf: z.number().int(),
  exp: z.number().int(),
  jti: z.string(),
  constraints: z.array(Constraint),
  mandate: Mandate,
});
export type MandateClaims = z.infer<typeof MandateClaims>;

const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const money = (value: Money) => ({ amount: value.amount, currency: value.currency });

/** `audience` is the workspace the mandate is signed for; no other workspace accepts it. */
export function toClaims(mandate: Mandate, audience: string): MandateClaims {
  return {
    vct: MANDATE_VCT,
    iss: mandate.buyer.id,
    sub: mandate.agent.id,
    aud: audience,
    iat: Math.floor(now().getTime() / 1000),
    nbf: seconds(mandate.validFrom),
    exp: seconds(mandate.validUntil),
    jti: mandate.id,
    constraints: [
      { type: "fi.valio.customer", customer_number: mandate.buyer.customerNumber },
      { type: "fi.valio.spend_limit", per_order: money(mandate.limits.perOrder), per_week: money(mandate.limits.perWeek) },
      { type: "fi.valio.categories", allowed: mandate.categories.allowed },
      {
        type: "fi.valio.dietary",
        exclude_allergens: mandate.dietary.excludeAllergens,
        block_may_contain: mandate.dietary.blockMayContain,
        required_claims: mandate.dietary.requiredClaims,
        ...(mandate.dietary.neverBuy
          ? { never_buy_products: mandate.dietary.neverBuy.products.map((item) => item.productId), never_buy_words: mandate.dietary.neverBuy.words }
          : {}),
      },
      {
        type: "fi.valio.substitution",
        policy: mandate.substitution.policy,
        max_price_increase_pct: mandate.substitution.maxPriceIncreasePct,
      },
      {
        type: "fi.valio.delivery",
        allow_partial: mandate.delivery.allowPartial,
        max_delay_days: mandate.delivery.maxDelayDays,
      },
      {
        type: "fi.valio.approval",
        approver: mandate.approval.approver,
        first_time_products: mandate.approval.firstTimeProducts,
        require_request_words: mandate.approval.requireRequestWords,
      },
    ],
    mandate,
  };
}

/** Parses claims and checks that the envelope agrees with the embedded mandate. */
export function fromClaims(payload: unknown): { mandate?: Mandate; audience?: string; reason?: string } {
  const parsed = MandateClaims.safeParse(payload);
  if (!parsed.success) return { reason: "The mandate does not have the expected shape." };
  const { iss, sub, jti, aud, mandate } = parsed.data;
  if (iss !== mandate.buyer.id) return { reason: "The mandate issuer is not the buyer named in it." };
  if (sub !== mandate.agent.id) return { reason: "The mandate subject is not the agent named in it." };
  if (jti !== mandate.id) return { reason: "The mandate id does not match its claims." };
  return { mandate, audience: aud };
}
