import type { AuditEntry, Order, SignedOffer } from "@/lib/contracts";

/** One call an agent made through the front door, shown in the activity pane. */
export interface Activity {
  id: string;
  at: string;
  agent: { id: string; name: string };
  kind: "tool" | "note";
  tool?: string;
  title: string;
  detail?: string;
  status: "ok" | "waiting" | "blocked" | "error";
  refs?: { offerId?: string; orderId?: string };
  durationMs?: number;
}

export interface Store {
  offers: {
    put(offer: SignedOffer): Promise<void>;
    get(id: string): Promise<SignedOffer | undefined>;
  };
  orders: {
    put(order: Order): Promise<void>;
    get(id: string): Promise<Order | undefined>;
    byIdempotencyKey(key: string): Promise<Order | undefined>;
    list(): Promise<Order[]>;
  };
  audit: {
    append(entry: AuditEntry): Promise<void>;
    list(afterSeq?: number): Promise<AuditEntry[]>;
    last(): Promise<AuditEntry | undefined>;
    /** Demo only: overwrite a stored entry to show that tampering is detected. */
    replace(seq: number, entry: AuditEntry): Promise<void>;
  };
  activity: {
    append(activity: Activity): Promise<void>;
    list(afterId?: string): Promise<Activity[]>;
  };
  mandate: {
    get(): Promise<string | undefined>;
    put(jws: string): Promise<void>;
  };
  reset(): Promise<void>;
}
