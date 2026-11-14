import type { UpstreamUsage } from "@/lib/valio/meter";
import type { Basket, BasketLine, BasketLineRequest, LineOption, LineOptionKind, Quantity } from "@/lib/contracts";

/** What the engine keeps to act on one option of a line; never shown to a caller. */
export interface HeldOption {
  kind: LineOptionKind;
  /** The order the option decides (approve, and skip of a waiting order). */
  orderId?: string;
  /** A signed offer the option orders as it was received (a wholesaler's alternative). */
  offerJws?: string;
  /** What to quote again when the held offer expired, or the option is a new quote (quantity, a safe swap). */
  quote?: HeldQuote;
}

/** A quote to ask for again: the lines in sales units and the words they are compared with. */
export interface HeldQuote {
  lines: { productId: string; quantity: Quantity }[];
  words: string;
}

/** A line as stored: the contract fields plus what the caller asked for and the options' signed material. */
export interface StoredLine extends BasketLine {
  request: BasketLineRequest;
  held: Record<string, HeldOption>;
}

/** The agent that works the basket, as the audit log and activity pane name it. */
export interface BasketAgent {
  id: string;
  name: string;
  buyer: { id: string; name: string };
  client?: string;
}

export interface StoredBasket extends Omit<Basket, "lines" | "totals" | "summary"> {
  agent: BasketAgent;
  lines: StoredLine[];
  /** When the last line finished, for secondsTaken. */
  finishedAt?: string;
  /** What working the lines asked the wholesaler's price and availability APIs. */
  usage: UpstreamUsage;
}

/** What working one line found, before it is written to the line. */
export type LineOutcome = Pick<BasketLine, "state" | "reasonCode" | "reason" | "product" | "packs" | "net" | "orderId" | "offerId" | "history"> & {
  options: OfferedOption[];
};

/** An option as a person sees it, with what the engine needs to carry it out. */
export interface OfferedOption {
  option: LineOption;
  held: HeldOption;
}
