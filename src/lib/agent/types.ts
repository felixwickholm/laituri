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
  /** The product in the buyer's words, without quantity, date, purpose or instructions. */
  phrase: string;
  /** What the buyer said the goods are for ("a dairy-free breakfast"); its claims are requirements too. */
  purpose?: string;
  /** The other sentences and clauses of the request, without the instructions read from them. */
  otherClauses: string[];
  /** A wholesaler product code named in the request, for example "product 462775". */
  productId?: string;
  deliverBy: string;
  /** False when no date was given and the next working day was assumed. */
  deliverByStated: boolean;
  /** The most the buyer will pay, in euros ("under 50 euros"). */
  budget?: number;
  /** The buyer asked a person to approve before anything is ordered ("ask me first"). */
  waitForPerson: boolean;
  /** The amount was given in boxes or cases ("kaks laatikkoa"), whose size the agent does not know. */
  packageWord?: string;
}

export interface PurchaseOptions {
  /** A product code the buyer already chose. The agent skips the search and quotes it directly. */
  productId?: string;
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
