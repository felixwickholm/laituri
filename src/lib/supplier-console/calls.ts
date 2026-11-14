import { eur, parseEur } from "@/lib/console/format/money";
import { shortProductName, tidyProductText } from "@/lib/console/format/product";
import type { Activity } from "@/lib/store/types";
import { toolVerb } from "./format";

/** One agent call as a short line: what kind of call, about what, and how it ended. Nothing is cut with an ellipsis. */
export interface CallLine {
  sentence: string;
  tone: "neutral" | "waiting" | "danger";
}

const SEARCH = /^Searched the catalogue for '(.+)'$/;
const QUOTE = /^Asked for a quote for (.+?) of (.+)$/;
const ORDER = /^Placed an order for ([\d,.]+) x (.+)$/;
const ALTERNATIVES = /\b([1-9]\d*) alternatives?\b/;

/** The short product name when it fits whole; the full tidied name when shortening would cut it with an ellipsis. */
function productWords(name: string): string {
  const short = shortProductName(name);
  return short.includes("…") ? tidyProductText(name) : short;
}

/** Net amounts of the offers quoted in the feed, by offer id, so an order line can say what it was worth. */
export function offerNets(activity: Activity[]): Map<string, number> {
  const nets = new Map<string, number>();
  for (const item of activity) {
    if (item.tool !== "request_quote" || !item.refs?.offerId) continue;
    const net = parseEur(item.detail);
    if (net !== undefined && net > 0) nets.set(item.refs.offerId, net);
  }
  return nets;
}

function quoteOutcome(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  if (/^Not available/i.test(detail)) return "not available";
  const alternatives = detail.match(ALTERNATIVES);
  if (/^Partial offer/i.test(detail)) return alternatives ? `partial, ${alternatives[1]} alternative${alternatives[1] === "1" ? "" : "s"}` : "partial";
  const net = parseEur(detail);
  return net !== undefined && net > 0 ? eur(net) : undefined;
}

const ORDER_WORDS: Record<Activity["status"], string> = {
  ok: "Order confirmed",
  waiting: "Order held for approval",
  blocked: "Order blocked by the buyer's rules",
  error: "Order refused",
};

/** "Quote · 200 l Arki Eila lactose-free milk 1 l · €220.00", "Order held for approval · €1,616.00", "Search · vegan feta". */
export function callLine(call: Activity, nets: Map<string, number>): CallLine {
  const tone: CallLine["tone"] = call.status === "waiting" ? "waiting" : call.status === "blocked" || call.status === "error" ? "danger" : "neutral";
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

  if (call.tool === "search_catalog") {
    const query = call.title.match(SEARCH)?.[1];
    if (query) return { tone, sentence: join("Search", query, /^No products/i.test(call.detail ?? "") ? "nothing found" : undefined) };
  }
  if (call.tool === "request_quote") {
    const match = call.title.match(QUOTE);
    if (match) return { tone, sentence: join("Quote", `${match[1]} ${productWords(match[2])}`, quoteOutcome(call.detail)) };
  }
  if (call.tool === "place_order" && ORDER.test(call.title)) {
    const net = (call.refs?.offerId && nets.get(call.refs.offerId)) || parseEur(call.detail);
    return { tone, sentence: join(ORDER_WORDS[call.status], net ? eur(net) : undefined) };
  }
  return { tone, sentence: join(toolVerb(call.tool), tidyProductText(call.title)) };
}
