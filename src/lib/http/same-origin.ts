import { ForbiddenError, bearerToken } from "./agent";
import { originOf } from "./origin";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The cookies that act for a person or a sandbox. */
const ACTING_COOKIES = /(?:^|;\s*)laituri_(?:workspace|approver|operator)=/;

/**
 * A write that acts through the browser's cookies must come from this site's own pages. A browser says where a request
 * came from in Sec-Fetch-Site, else in Origin; a client that sends neither is not a browser another site can steer.
 * An agent's bearer key is never sent by a browser on its own, so a keyed call is left alone.
 */
export function refuseCrossSite(request: Request): void {
  if (READS.has(request.method) || bearerToken(request.headers)) return;
  if (!ACTING_COOKIES.test(request.headers.get("cookie") ?? "")) return;
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const crossSite = site ? site !== "same-origin" : origin ? origin !== originOf(request) : false;
  if (crossSite) throw new ForbiddenError("This change must come from Laituri's own pages.", "cross_site_request");
}
