import type { JSONWebKeySet } from "jose";

/** supplier signs offers, receipts and audit entries; buyer signs mandates; approver signs approvals. */
export type SignerRole = "supplier" | "buyer" | "approver";

/**
 * The JOSE "typ" header of each kind of signed object. Every verification names the type it expects,
 * so a token signed for one purpose is never accepted for another, even when the same key signs both.
 */
export const TOKEN_TYPE = {
  offer: "offer+jwt",
  mandate: "mandate+jwt",
  approval: "approval+jwt",
  receipt: "receipt+jwt",
  audit: "audit+jwt",
  checkpoint: "checkpoint+jwt",
  session: "console+jwt",
} as const;
export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

export interface Verified<T> {
  valid: boolean;
  payload?: T;
  keyId?: string;
  reason?: string;
}

export interface Trust {
  sign(role: SignerRole, payload: object, typ: TokenType): Promise<string>;
  verify<T>(role: SignerRole, jws: string, typ: TokenType): Promise<Verified<T>>;
  jwks(role: SignerRole): Promise<JSONWebKeySet>;
}
