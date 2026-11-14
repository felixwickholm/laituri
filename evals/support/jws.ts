import { CompactSign, decodeProtectedHeader, generateKeyPair } from "jose";

function decodePart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

/** The payload of a compact JWS, read without checking the signature. */
export function payloadOf<T>(jws: string): T {
  return decodePart<T>(jws.split(".")[1]);
}

/** A new payload under the original header and signature: what a hostile caller can send. */
export function withPayload<T>(jws: string, edit: (payload: T) => T): string {
  const [header, payload, signature] = jws.split(".");
  const edited = Buffer.from(JSON.stringify(edit(decodePart<T>(payload))), "utf8").toString("base64url");
  return [header, edited, signature].join(".");
}

/** Changes one byte of the signed payload (the first digit) and keeps the signature. */
export function changeOneByte(jws: string): string {
  const [header, payload, signature] = jws.split(".");
  const text = Buffer.from(payload, "base64url").toString("utf8");
  const at = text.search(/\d/);
  if (at < 0) throw new Error("The payload has no digit to change.");
  const swapped = text[at] === "9" ? "8" : String(Number(text[at]) + 1);
  const edited = Buffer.from(text.slice(0, at) + swapped + text.slice(at + 1), "utf8").toString("base64url");
  return [header, edited, signature].join(".");
}

/**
 * Signs with a key nobody published. With spoofKidOf, the header claims the kid of a real token,
 * so only the signature check can catch it.
 */
export async function signWithFreshKey(payload: object, typ: string, spoofKidOf?: string): Promise<string> {
  const { privateKey } = await generateKeyPair("ES256");
  const kid = spoofKidOf ? decodeProtectedHeader(spoofKidOf).kid : "agent-own-key";
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "ES256", kid, typ })
    .sign(privateKey);
}
