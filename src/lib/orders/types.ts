import type {
  Actor,
  AuditEntry,
  AuditEvent,
  AuditVerification,
  Decision,
  Mandate,
  Offer,
  Product,
} from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import type { Store } from "@/lib/store/types";
import type { SignerRole, Verified } from "@/lib/trust/types";

export interface MandateRead {
  valid: boolean;
  mandate?: Mandate;
  reason?: string;
}

export interface OfferRead {
  valid: boolean;
  offer?: Offer;
  reason?: string;
}

export interface PolicyInput {
  mandate: MandateRead;
  offer: OfferRead;
  products: Map<string, Product>;
  agentId: string;
  weekSpendNet: number;
  orderedProductIds: Set<string>;
  now: Date;
}

export interface PolicyEngine {
  evaluate(input: PolicyInput): Decision | Promise<Decision>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type MandatePatch = DeepPartial<Mandate>;

export interface SignedMandate {
  jws: string;
  mandate: Mandate;
}

export interface MandateService {
  read(jws: string): Promise<MandateRead>;
  current(): Promise<SignedMandate>;
  update(patch: MandatePatch): Promise<SignedMandate>;
}

export interface AuditInput {
  actor: Actor;
  event: AuditEvent;
  summary: string;
  refs?: AuditEntry["refs"];
  data?: Record<string, unknown>;
}

export interface AuditLog {
  append(input: AuditInput): Promise<AuditEntry>;
  verify(): Promise<AuditVerification>;
  /** Drops the remembered head when the log is cleared on purpose. */
  forget?(): void;
}

export interface OrderDeps {
  catalog: Pick<Catalog, "get">;
  trust: Signer & { verify<T>(role: SignerRole, jws: string): Promise<Verified<T>> };
  store: Pick<Store, "offers" | "orders">;
  policy: PolicyEngine;
  mandates: MandateService;
  audit: AuditLog;
  /** Stable hash of a JSON value (SHA-256 over canonical JSON), used to bind receipts and approvals to an offer. */
  hash(value: unknown): Promise<string>;
  now: () => Date;
}

export type { StoredOrder } from "@/lib/store";

/** Signing with an optional JOSE typ header, such as "receipt+jwt". */
export interface Signer {
  sign(role: SignerRole, payload: object, options?: { typ?: string }): Promise<string>;
}

export interface Caller {
  id: string;
  name: string;
}
