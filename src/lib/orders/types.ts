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
import type { SignerRole, TokenType, Verified } from "@/lib/trust/types";

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

/** Signed mandates, one per buyer. A call that names no buyer means the primary buyer. */
export interface MandateService {
  read(jws: string): Promise<MandateRead>;
  current(buyerId?: string): Promise<SignedMandate>;
  update(patch: MandatePatch, buyerId?: string): Promise<SignedMandate>;
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
  trust: Signer & { verify<T>(role: SignerRole, jws: string, typ: TokenType): Promise<Verified<T>> };
  store: Pick<Store, "offers" | "orders">;
  policy: PolicyEngine;
  mandates: MandateService;
  audit: AuditLog;
  /** Stable hash of a JSON value (SHA-256 over canonical JSON), used to bind receipts and approvals to an offer. */
  hash(value: unknown): Promise<string>;
  now: () => Date;
}

export type { StoredOrder } from "@/lib/store";

/** Signing with the JOSE typ header of the object signed, such as "receipt+jwt". */
export interface Signer {
  sign(role: SignerRole, payload: object, typ: TokenType): Promise<string>;
}

export interface Caller {
  id: string;
  name: string;
  /** The buyer the calling agent works for. Its orders belong to that buyer whatever mandate it presents. */
  buyer?: { id: string; name: string };
}

/** Who decides an approval or changes a mandate: the signed-in approver of one buyer. */
export interface Decider {
  buyerId: string;
  /** How the person signed in, when the audit entry must say so, for example "demo access". */
  via?: string;
}
