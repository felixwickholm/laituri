import type { AgentSuspension, AuditEntry, BasketLine, DemandOutcome, Handoff, Order, Quantity, SignedOffer } from "@/lib/contracts";
import type { DemandRecord } from "@/lib/demand/types";
import type { Activity } from "@/lib/store/types";

export type {
  ConceptDemand,
  ConnectedAgent,
  DailyPoint,
  OfferStats,
  OrderOutcome,
  OrderStats,
  OutcomeCounts,
  RuleStat,
  SupplierOverview,
  UnmetReason,
  UnmetRequest,
} from "@/lib/contracts";

/** Everything the wholesaler holds: what reached it, in the shapes it stored them. */
export interface InsightInput {
  now: Date;
  orders: Order[];
  offers: SignedOffer[];
  requests: DemandRecord[];
  activity: Activity[];
  suspensions: AgentSuspension[];
  /** The signed log; the overview reads which quote issued each alternative offer. */
  audit: AuditEntry[];
  /** The lines of every basket, for the share ordered without a person; none when not given. */
  baskets?: { lines: (Pick<BasketLine, "state"> & Partial<Pick<BasketLine, "resolved" | "orderId">>)[] }[];
  handoffs?: Pick<Handoff, "status">[];
}

export interface Party {
  id: string;
  name: string;
}

/** One request, a search and the quotes that followed it, seen as a whole. */
export interface RequestSummary {
  requestId: string;
  at: string;
  buyer?: Party;
  agent: Party;
  client: string;
  words?: string;
  concept?: string;
  quantity?: Quantity;
  deliverBy?: string;
  outcome: DemandOutcome;
  lostNet?: number;
  seeded?: true;
}
