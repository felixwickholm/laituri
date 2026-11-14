import type { Order } from "@/lib/contracts";
import type { SignedMandate } from "../types";

/** The orders placed for the buyer whose mandate the console shows. Before the mandate loads, all of them. */
export function buyerOrders(orders: Order[], mandate: SignedMandate | undefined): Order[] {
  const buyerId = mandate?.mandate.buyer.id;
  return buyerId ? orders.filter((order) => order.buyer.id === buyerId) : orders;
}

/** Records written at start-up as demo history carry `seeded: true`; live use never does. */
export function isSeeded(record: object): boolean {
  return (record as { seeded?: unknown }).seeded === true;
}
