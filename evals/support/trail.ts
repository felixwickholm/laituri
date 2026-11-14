import type { JSONWebKeySet } from "jose";
import { decodeProtectedHeader } from "jose";
import type { AuditEntry, Order, SignedOffer } from "@/lib/contracts";
import { verifyChain, type LogHead } from "@/lib/audit/verify";
import { verifyWithJwks, type SignerRole } from "@/lib/trust";
import { approverCookie, mandate, orderLitres } from "./flow";
import { pendingOrder } from "./hostile";
import { AGENT_AUTH, get, ok, post } from "./router";

/** Everything a buyer or auditor can collect from the public interface after two orders. */
export interface Trail {
  jwks: JSONWebKeySet;
  offer: SignedOffer;
  mandateJws: string;
  auto: Order;
  approved: Order;
  entries: AuditEntry[];
  head: LogHead;
  checkpointJws: string;
}

/** One order inside the mandate and one approved by a person, then the public documents. */
export async function buildTrail(): Promise<Trail> {
  const auto = await orderLitres(1000, "eval-trust-auto");
  const pending = await pendingOrder("eval-trust-pending");
  const cookie = await approverCookie();
  const approved = ok<Order>(await post(`/api/v1/approvals/${pending.id}`, { decision: "approved" }, { cookie }), "Approval");
  const offer = ok<SignedOffer>(await get(`/api/v1/offers/${auto.offer.id}`, AGENT_AUTH), "Offer lookup");
  const { entries } = ok<{ entries: AuditEntry[] }>(await get("/api/v1/audit"), "Audit log");
  const { checkpoint, jws } = ok<{ checkpoint: LogHead; jws: string }>(await get("/api/v1/audit/checkpoint"), "Checkpoint");
  const jwks = ok<JSONWebKeySet>(await get("/.well-known/jwks.json"), "JWKS");
  if (auto.status !== "confirmed" || approved.status !== "confirmed") {
    throw new Error(`The trail orders ended ${auto.status} and ${approved.status}, not confirmed.`);
  }
  return { jwks, offer, mandateJws: (await mandate()).jws, auto, approved, entries, head: checkpoint, checkpointJws: jws };
}

export interface RoleCheck<T> {
  valid: boolean;
  role?: string;
  typ?: string;
  payload?: T;
  reason?: string;
}

/** Verifies with the published JWKS only, and reports which role's key signed. */
export async function verifyAs<T>(jws: string, jwks: JSONWebKeySet, role: SignerRole): Promise<RoleCheck<T>> {
  const result = await verifyWithJwks<T>(jws, jwks);
  const key = jwks.keys.find((candidate) => candidate.kid === result.keyId) as { role?: string } | undefined;
  let typ: string | undefined;
  try {
    typ = decodeProtectedHeader(jws).typ;
  } catch {
    typ = undefined;
  }
  const valid = result.valid && key?.role === role;
  return { valid, role: key?.role, typ, payload: result.payload, reason: result.valid ? (valid ? undefined : `signed by ${key?.role}`) : result.reason };
}

/** The audit chain check with signatures verified against the JWKS. */
export function verifyEntries(entries: AuditEntry[], jwks: JSONWebKeySet, head?: LogHead) {
  return verifyChain(entries, (jws) => verifyWithJwks(jws, jwks), head);
}
