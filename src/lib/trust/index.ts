import type { JSONWebKeySet } from "jose";
import { roleKey } from "./keys";
import { signCompact, verifyCompact } from "./jws";
import type { SignerRole, Trust, TokenType, Verified } from "./types";

export { canonicalize, sha256Hex } from "./canonical";
export { verifyWithJwks } from "./jws";
export { ROLES } from "./keys";
export { TOKEN_TYPE } from "./types";
export type { SignerRole, Trust, TokenType, Verified } from "./types";

const service: Trust = {
  async sign(role, payload, typ) {
    const key = await roleKey(role);
    return signCompact(key.privateKey, key.kid, payload, typ);
  },
  async verify<T>(role: SignerRole, jws: string, typ: TokenType): Promise<Verified<T>> {
    try {
      const key = await roleKey(role);
      return await verifyCompact<T>(key.publicKey, key.kid, jws, typ);
    } catch {
      return { valid: false, reason: "unknown key" };
    }
  },
  jwks,
};

export function trust(): Trust {
  return service;
}

/** Public key set for one role. Contains no private material. */
export async function jwks(role: SignerRole): Promise<JSONWebKeySet> {
  const key = await roleKey(role);
  return { keys: [key.publicJwk] };
}
