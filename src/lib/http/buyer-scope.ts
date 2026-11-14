import { ValidationError } from "@/lib/gateway/errors";
import { PRIMARY_BUYER_ID, isKnownBuyer } from "@/lib/mandate";
import { ForbiddenError, bearerToken, resolveAgent, restCall } from "./agent";
import { readSession } from "./console-session";

/**
 * The buyer a read is about. An agent token reads only its own buyer's records and may not name another.
 * Anyone else may name a buyer with ?buyer=; without one, the signed-in approver's buyer, else the primary buyer.
 */
export async function readerBuyer(request: Request): Promise<string> {
  const named = new URL(request.url).searchParams.get("buyer")?.trim() || undefined;
  if (bearerToken(request.headers)) {
    const own = (await resolveAgent(request.headers, restCall(request))).buyer?.id ?? PRIMARY_BUYER_ID;
    if (named && named !== own) throw new ForbiddenError("An agent can read only its own buyer's records.", "other_buyer");
    return own;
  }
  if (named) {
    if (!isKnownBuyer(named)) throw new ValidationError(`No buyer with the id ${named} is known.`);
    return named;
  }
  return (await readSession(request.headers)).buyer?.id ?? PRIMARY_BUYER_ID;
}
