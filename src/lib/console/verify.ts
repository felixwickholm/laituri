import type { JSONWebKeySet } from "jose";
import type { AuditEntry } from "@/lib/contracts";
import { verifyChain, type LogHead } from "@/lib/audit/verify";
import { canonicalize, sha256Hex } from "@/lib/trust/canonical";
import { verifyWithJwks } from "@/lib/trust/jws";
import { TOKEN_TYPE, type TokenType } from "@/lib/trust/types";
import type { ChainState, Jwks, PublicKey } from "./types";

/** Who owns a key, in the words the console shows. */
export type KeyRole = NonNullable<PublicKey["role"]>;

export interface SignatureCheck {
  valid: boolean;
  role?: KeyRole;
  reason?: string;
  payload?: unknown;
}

/** The signed objects the console checks. */
export type SignedKind = "audit" | "offer" | "approval" | "receipt" | "mandate";

/** Who must have signed each kind, and the JWS type it must carry, so a token signed for one purpose never passes for another. */
export const SIGNED_KIND: Record<SignedKind, { role: KeyRole; typ: TokenType }> = {
  audit: { role: "supplier", typ: TOKEN_TYPE.audit },
  offer: { role: "supplier", typ: TOKEN_TYPE.offer },
  receipt: { role: "supplier", typ: TOKEN_TYPE.receipt },
  mandate: { role: "buyer", typ: TOKEN_TYPE.mandate },
  approval: { role: "approver", typ: TOKEN_TYPE.approval },
};

function asKeySet(jwks: Jwks): JSONWebKeySet {
  return jwks as unknown as JSONWebKeySet;
}

export function roleOf(jwks: Jwks, kid: string | undefined): KeyRole | undefined {
  return jwks.keys.find((key) => key.kid === kid)?.role;
}

/** Verifies one compact JWS as the given kind of object: its token type, and the role whose key signed it. */
export async function checkSignature(jws: string | undefined, jwks: Jwks | undefined, kind: SignedKind): Promise<SignatureCheck> {
  if (!jws) return { valid: false, reason: "No signature was recorded." };
  if (!jwks) return { valid: false, reason: "The public keys are not loaded yet." };
  const expected = SIGNED_KIND[kind];
  const result = await verifyWithJwks<unknown>(jws, asKeySet(jwks), expected.typ);
  const role = roleOf(jwks, result.keyId);
  if (!result.valid) return { valid: false, role, reason: result.reason };
  if (role !== expected.role) return { valid: false, role, reason: role ? `signed with the ${role} key` : "signed with an unknown key" };
  return { valid: true, role, payload: result.payload };
}

/**
 * The newest verified head this browser session has seen. Passing it to the check means a log whose
 * newest entries were removed is reported, not silently accepted as a shorter valid log.
 */
let remembered: LogHead | undefined;

/** Forget the remembered head; used when the person resets the demo on purpose. */
export function forgetHead(): void {
  remembered = undefined;
}

/** Runs the full hash-chain and signature check in the browser, oldest entry first. */
export async function checkChain(entries: AuditEntry[], jwks: Jwks | undefined): Promise<ChainState> {
  if (entries.length === 0 && !remembered) return { state: "empty" };
  if (!jwks) return { state: "checking", entries: entries.length };
  const ordered = [...entries].sort((a, b) => a.seq - b.seq);
  const keys = asKeySet(jwks);
  const result = await verifyChain(ordered, (jws) => verifyWithJwks(jws, keys, TOKEN_TYPE.audit), remembered);
  if (result.valid) {
    if (result.head && (!remembered || result.entries >= remembered.size)) {
      remembered = { size: result.entries, head: result.head };
    }
    return { state: "verified", entries: result.entries, head: result.head };
  }
  return {
    state: "broken",
    entries: result.entries,
    brokenAt: result.brokenAt ?? ordered[0]?.seq ?? 1,
    reason: result.reason ?? "The log does not verify.",
  };
}

/** True when a signed payload carries exactly the object shown. */
export function sameContent(a: unknown, b: unknown): boolean {
  return canonicalize(a) === canonicalize(b);
}

export const hashOf = sha256Hex;
