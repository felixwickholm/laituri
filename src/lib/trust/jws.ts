import { CompactSign, compactVerify, decodeProtectedHeader, importJWK, type CryptoKey, type JSONWebKeySet, type JWK } from "jose";
import type { TokenType, Verified } from "./types";

export const ALG = "ES256";

const MALFORMED = "malformed token";
const UNKNOWN_KEY = "unknown key";
const BAD_SIGNATURE = "signature does not match";
const WRONG_TYPE = "wrong token type";

export async function signCompact(
  privateKey: CryptoKey,
  kid: string,
  payload: object,
  typ: TokenType,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return new CompactSign(bytes).setProtectedHeader({ alg: ALG, kid, typ }).sign(privateKey);
}

/** Verifies against one known key and requires the expected token type. Never throws. */
export async function verifyCompact<T>(publicKey: CryptoKey, kid: string, jws: string, typ: TokenType): Promise<Verified<T>> {
  const header = readHeader(jws);
  if (!header) return { valid: false, reason: MALFORMED };
  if (header.kid !== kid) return { valid: false, keyId: header.kid, reason: UNKNOWN_KEY };
  if (header.typ !== typ) return { valid: false, keyId: kid, reason: WRONG_TYPE };
  return verifyWithKey<T>(publicKey, kid, jws);
}

/**
 * Verifies with a public JWKS only, so it runs in the browser as well as on the server. Never throws.
 * With `typ`, a token of another type is refused.
 */
export async function verifyWithJwks<T>(jws: string, jwks: JSONWebKeySet, typ?: TokenType): Promise<Verified<T>> {
  const header = readHeader(jws);
  if (!header) return { valid: false, reason: MALFORMED };
  if (typ && header.typ !== typ) return { valid: false, keyId: header.kid, reason: WRONG_TYPE };
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) return { valid: false, keyId: header.kid, reason: UNKNOWN_KEY };
  let key: CryptoKey;
  try {
    key = (await importJWK(jwk as JWK, ALG)) as CryptoKey;
  } catch {
    return { valid: false, keyId: header.kid, reason: UNKNOWN_KEY };
  }
  return verifyWithKey<T>(key, header.kid as string, jws);
}

function readHeader(jws: string): { kid?: string; typ?: string } | undefined {
  if (typeof jws !== "string" || jws.split(".").length !== 3) return undefined;
  try {
    const header = decodeProtectedHeader(jws);
    return header.alg === ALG ? { kid: header.kid, typ: header.typ } : undefined;
  } catch {
    return undefined;
  }
}

async function verifyWithKey<T>(key: CryptoKey, kid: string, jws: string): Promise<Verified<T>> {
  let bytes: Uint8Array;
  try {
    ({ payload: bytes } = await compactVerify(jws, key, { algorithms: [ALG] }));
  } catch (error) {
    const code = (error as { code?: string }).code;
    return { valid: false, keyId: kid, reason: code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ? BAD_SIGNATURE : MALFORMED };
  }
  try {
    return { valid: true, keyId: kid, payload: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { valid: false, keyId: kid, reason: MALFORMED };
  }
}
