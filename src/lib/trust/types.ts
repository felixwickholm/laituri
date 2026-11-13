import type { JSONWebKeySet } from "jose";

/** supplier signs offers, receipts and audit entries; buyer signs mandates; approver signs approvals. */
export type SignerRole = "supplier" | "buyer" | "approver";

export interface Verified<T> {
  valid: boolean;
  payload?: T;
  keyId?: string;
  reason?: string;
}

export interface Trust {
  sign(role: SignerRole, payload: object): Promise<string>;
  verify<T>(role: SignerRole, jws: string): Promise<Verified<T>>;
  jwks(role: SignerRole): Promise<JSONWebKeySet>;
}
