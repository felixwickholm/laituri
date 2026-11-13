import type { JSONWebKeySet } from "jose";
import { roleKey } from "./keys";
import { signCompact, verifyCompact } from "./jws";
import type { SignerRole, Trust, Verified } from "./types";

export { canonicalize, sha256Hex } from "./canonical";
export { verifyWithJwks } from "./jws";
export { ROLES } from "./keys";
export type { SignerRole, Trust, Verified } from "./types";

export interface SignOptions {
  /** JOSE "typ" header, for example "offer+jwt". Defaults to "JWT". */
  typ?: string;
}

/** Trust with an optional typ header on sign; still assignable to Trust. */
export interface TrustService extends Trust {
  sign(role: SignerRole, payload: object, options?: SignOptions): Promise<string>;
}

const service: TrustService = {
  async sign(role, payload, options) {
    const key = await roleKey(role);
    return signCompact(key.privateKey, key.kid, payload, options?.typ);
  },
  async verify<T>(role: SignerRole, jws: string): Promise<Verified<T>> {
    try {
      const key = await roleKey(role);
      return await verifyCompact<T>(key.publicKey, key.kid, jws);
    } catch {
      return { valid: false, reason: "unknown key" };
    }
  },
  jwks,
};

export function trust(): TrustService {
  return service;
}

/** Public key set for one role. Contains no private material. */
export async function jwks(role: SignerRole): Promise<JSONWebKeySet> {
  const key = await roleKey(role);
  return { keys: [key.publicJwk] };
}
