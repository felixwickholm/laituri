import type { Offer } from "@/lib/contracts";

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

function encodePart(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/** Swap the payload of a compact JWS and keep the original header and signature. */
export function replacePayload<T extends object>(jws: string, edit: (payload: T) => T): string {
  const [header, payload, signature] = jws.split(".");
  return [header, encodePart(edit(decodePart(payload) as T)), signature].join(".");
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** The same offer with every unit price cut to a hundredth, totals recomputed so it looks consistent. */
export function cutPrice(offer: Offer): Offer {
  const lines = offer.lines.map((line) => {
    const unitPrice = { ...line.unitPrice, amount: cents(line.unitPrice.amount / 100) };
    return { ...line, unitPrice, lineNet: { ...line.lineNet, amount: cents(line.quantity * unitPrice.amount) } };
  });
  const net = cents(lines.reduce((sum, line) => sum + line.lineNet.amount, 0));
  const tax = cents(lines.reduce((sum, line) => sum + (line.lineNet.amount * line.taxRate) / 100, 0));
  return { ...offer, lines, totals: { net: { amount: net, currency: "EUR" }, tax: { amount: tax, currency: "EUR" }, gross: { amount: cents(net + tax), currency: "EUR" } } };
}

interface Claims {
  constraints?: Array<Record<string, unknown>>;
  mandate: { limits: { perOrder: { amount: number } } };
}

/** The same mandate with a higher per-order limit, in the embedded mandate and in its constraint. */
export function raiseLimit<T extends Claims>(claims: T, amount: number): T {
  const mandate = { ...claims.mandate, limits: { ...claims.mandate.limits, perOrder: { ...claims.mandate.limits.perOrder, amount } } };
  const constraints = claims.constraints?.map((constraint) =>
    constraint.type === "fi.valio.spend_limit"
      ? { ...constraint, per_order: { ...(constraint.per_order as object), amount } }
      : constraint,
  );
  return { ...claims, mandate, constraints };
}
