import type { Order } from "@/lib/contracts";
import { NotFoundError } from "@/lib/gateway/errors";
import type { OrderDeps } from "./types";

export { placeOrder, UNKNOWN_AGENT } from "./place";
export { decideApproval } from "./approval";
export { responseCode, type ReceiptPayload } from "./receipt";
export type * from "./types";

function newestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(id: string, deps: Pick<OrderDeps, "store">): Promise<Order> {
  const order = await deps.store.orders.get(id);
  if (!order) throw new NotFoundError(`Order ${id} was not found.`);
  return order;
}

export async function listOrders(deps: Pick<OrderDeps, "store">): Promise<Order[]> {
  return newestFirst(await deps.store.orders.list());
}

export async function pendingApprovals(deps: Pick<OrderDeps, "store">): Promise<Order[]> {
  return (await listOrders(deps)).filter((order) => order.status === "pending_approval");
}
