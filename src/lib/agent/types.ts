import type {
  Mandate,
  Order,
  PlaceOrderRequest,
  Product,
  Quantity,
  QuoteRequest,
  QuoteResponse,
  SearchResponse,
} from "@/lib/contracts";
import type { SearchInput } from "@/lib/gateway/types";
import type { Activity } from "@/lib/store/types";

/** The operations an outside purchasing agent has. Nothing else. */
export interface AgentTransport {
  searchCatalog(request: SearchInput): Promise<SearchResponse>;
  getProduct(id: string): Promise<Product>;
  requestQuote(request: QuoteRequest): Promise<QuoteResponse>;
  getMandate(): Promise<{ jws: string; mandate: Mandate }>;
  placeOrder(request: PlaceOrderRequest): Promise<Order>;
  getOrder(id: string): Promise<Order>;
}

export type NoteStatus = Activity["status"];

export interface AgentHooks {
  /** One agent thought worth showing to a person. */
  note(text: string, status?: NoteStatus): void | Promise<void>;
  /** Awaited between steps so a person can follow along. */
  pause(): Promise<void>;
}

/** What the agent understood from the buyer's words. */
export interface ParsedRequest {
  text: string;
  quantity?: Quantity;
  /** The product in the buyer's words, without quantity and date. */
  phrase: string;
  /** A wholesaler product code named in the request, for example "product 462775". */
  productId?: string;
  deliverBy: string;
  /** False when no date was given and the next working day was assumed. */
  deliverByStated: boolean;
}

export type PurchaseStatus = "confirmed" | "waiting" | "blocked" | "not_found" | "needs_input" | "failed";

export interface PurchaseStep {
  text: string;
  status: NoteStatus;
}

export interface PurchaseResult {
  status: PurchaseStatus;
  orderId?: string;
  offerId?: string;
  summary: string;
  steps: PurchaseStep[];
}

export const DEMO_AGENT = { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" } as const;
