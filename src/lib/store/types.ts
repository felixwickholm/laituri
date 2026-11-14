import type { AgentSuspension, AuditEntry, Order, SignedOffer } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";

/** One call an agent made through the front door, shown in the activity pane. */
export interface Activity {
  id: string;
  at: string;
  agent: { id: string; name: string };
  /** The buyer whose agent made the call; absent for a caller without a token. */
  buyer?: { id: string; name: string };
  /** The client application that made the call, for example "Claude Code" or "curl". */
  client?: string;
  kind: "tool" | "note";
  tool?: string;
  title: string;
  detail?: string;
  status: "ok" | "waiting" | "blocked" | "error";
  refs?: { offerId?: string; orderId?: string };
  durationMs?: number;
  /** The purchase this belongs to, when a scripted run made it. Groups the activity pane exactly. */
  run?: { id: string; title: string };
  seeded?: true;
}

export interface Store {
  offers: {
    put(offer: SignedOffer): Promise<void>;
    get(id: string): Promise<SignedOffer | undefined>;
    list(): Promise<SignedOffer[]>;
  };
  orders: {
    put(order: Order): Promise<void>;
    get(id: string): Promise<Order | undefined>;
    byIdempotencyKey(key: string): Promise<Order | undefined>;
    list(): Promise<Order[]>;
    /** Undoes the save of an order whose audit entry could not be written. */
    remove(id: string): Promise<void>;
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
  /** Append-only: every catalogue search and quote that reached the wholesaler. */
  requests: {
    append(record: DemandRecord): Promise<void>;
    list(): Promise<DemandRecord[]>;
  };
  /** Each buyer's signed mandate JWS, by buyer id. */
  mandates: {
    get(buyerId: string): Promise<string | undefined>;
    put(buyerId: string, jws: string): Promise<void>;
  };
  /** Agents the wholesaler has suspended, by agent id. */
  suspensions: {
    get(agentId: string): Promise<AgentSuspension | undefined>;
    put(suspension: AgentSuspension): Promise<void>;
    remove(agentId: string): Promise<void>;
    list(): Promise<AgentSuspension[]>;
  };
  reset(): Promise<void>;
}
