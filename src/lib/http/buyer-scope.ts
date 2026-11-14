import { ValidationError } from "@/lib/gateway/errors";
import { PRIMARY_BUYER_ID, isKnownBuyer } from "@/lib/mandate";
import { ForbiddenError } from "./agent";
import { approverSession } from "./console-session";
import { requireReader } from "./reader";

/**
 * The buyer a read is about; `what` names the records for the 401 a caller without a credential gets.
 * An agent token reads only its own buyer's records and may not name another. A browser in its sandbox or a signed-in
 * person may name a buyer with ?buyer=; without one, the signed-in approver's buyer, else the primary buyer.
 */
export async function readerBuyer(request: Request, what: string): Promise<string> {
  const named = new URL(request.url).searchParams.get("buyer")?.trim() || undefined;
  const reader = await requireReader(request, what);
  if (reader.kind === "agent") {
    if (named && named !== reader.buyerId) throw new ForbiddenError("An agent can read only its own buyer's records.", "other_buyer");
    return reader.buyerId;
  }
  if (named) {
    if (!isKnownBuyer(named)) throw new ValidationError(`No buyer with the id ${named} is known.`);
    return named;
  }
  return (await approverSession(request.headers))?.buyer.id ?? PRIMARY_BUYER_ID;
}
