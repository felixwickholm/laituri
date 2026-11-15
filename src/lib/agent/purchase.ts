import { randomUUID } from "node:crypto";
import type { Mandate, Offer, Order } from "@/lib/contracts";
import { now } from "@/lib/clock";
import { packText } from "@/lib/console/format/packs";
import { shortDay } from "./dates";
import { findCandidates } from "./find";
import { parseRequest } from "./parse-request";
import { quoteRefusal } from "./refusal";
import { selectOffer } from "./select-offer";
import type {
  AgentHooks,
  AgentTransport,
  NoteStatus,
  ParsedRequest,
  PurchaseOptions,
  PurchaseResult,
  PurchaseStatus,
  PurchaseStep,
} from "./types";
import { displayName, euro, personName, quantityText } from "./words";

/** "1,000 × Valio Eila 1 l = 1,000 l", "3 cases of Dafgårds ciabatta 58g = 13.92 kg" or "51 × A = 51 l and 149 × B = 149 l". */
export function offerSubject(offer: Offer): string {
  return offer.lines
    .filter((line) => line.quantity > 0)
    .map((line) => packText(line, displayName(line.name)))
    .join(" and ");
}

function validMinutes(offer: Offer): number {
  return Math.round((Date.parse(offer.expiresAt) - Date.parse(offer.issuedAt)) / 60000);
}

function outcome(order: Order, mandate: Mandate): { status: PurchaseStatus; note: string; summary: string } {
  const approver = personName(mandate.approval.approver.name);
  const subject = `${offerSubject(order.offer)}, ${euro(order.offer.totals.net.amount)} net`;
  if (order.status === "confirmed") {
    const when = order.offer.deliveryDate ? `, delivery ${shortDay(order.offer.deliveryDate)}` : "";
    return { status: "confirmed", note: "Inside my mandate. Order placed.", summary: `Order ${order.id} confirmed: ${subject}${when}.` };
  }
  if (order.status === "pending_approval") {
    const ask = order.decision.checks.find((check) => check.status === "ask");
    const reason = ask?.rule === "spend.per_order"
      ? `Over my limit of ${euro(mandate.limits.perOrder.amount, true)}.`
      : ask?.message ?? "A person must decide.";
    return {
      status: "waiting",
      note: `${reason} Waiting for ${approver}.`,
      summary: `Order ${order.id} is waiting for ${approver}: ${subject}. ${reason}`,
    };
  }
  const block = order.decision.checks.find((check) => check.status === "block");
  const reason = block?.message ?? (order.status === "rejected" ? "The order was rejected." : "The order is outside my mandate.");
  return { status: "blocked", note: `Blocked. ${reason}`, summary: `Order ${order.id} was blocked: ${reason} Nothing was ordered.` };
}

type Lang = "fi" | "sv" | "en";

/** A rough guess from common words; the question back is asked in the buyer's language. */
export function languageOf(text: string): Lang {
  const words = text.toLowerCase();
  if (/\b(jag|vi|behöver|och|till|smör|mjölk|grädde|beställ|kan|för|på)\b|[å]/.test(words)) return "sv";
  if (/\b(tarvitsen|tarvitaan|tilaa|ja|maitoa?|voita?|kermaa?|litraa|kiloa|mennessä|huomenna|meille|haluan)\b|maanantai|tiistai|keskiviikko|torstai|perjantai/.test(words) || /[äö]/.test(words)) return "fi";
  return "en";
}

const ASK: Record<Lang, { which: string; packSize: (amount: number, word: string, what: string) => string; oneAtATime: (what: string) => string; offTask: string; howMuch: (what: string) => string; tooSmall: (what: string) => string }> = {
  en: {
    which: "Which product do you need?",
    packSize: (amount, word, what) => `How big is one ${word.replace(/es$|s$/, "")}? Say the ${what} in litres or kilograms, for example "${amount * 10} l", or name the pack size.`,
    oneAtATime: (what) => `I order one product per request. Which first, and how much: ${what}?`,
    offTask: "I can only search, get signed prices and order products for your kitchen. A person approves orders and sets the limits.",
    howMuch: (what) => `How much ${what} do you need, and by which day?`,
    tooSmall: (what) => `That amount is too small to order. How much ${what} do you need?`,
  },
  fi: {
    which: "Mitä tuotetta tarvitset?",
    packSize: (amount, _word, what) => `En tiedä laatikon kokoa. Kerro määrä litroina tai kiloina (${what}), esimerkiksi "${amount * 10} l", tai pakkauskoko.`,
    oneAtATime: (what) => `Tilaan yhden tuotteen kerrallaan. Kumpi ensin, ja kuinka paljon: ${what}?`,
    offTask: "Voin vain hakea tuotteita, pyytää allekirjoitetun hinnan ja tilata keittiöllesi. Ihminen hyväksyy tilaukset ja asettaa rajat.",
    howMuch: (what) => `Kuinka paljon tarvitset (${what}), ja mihin päivään mennessä?`,
    tooSmall: (what) => `Määrä on liian pieni tilattavaksi. Kuinka paljon tarvitset (${what})?`,
  },
  sv: {
    which: "Vilken produkt behöver du?",
    packSize: (amount, _word, what) => `Jag vet inte hur stor lådan är. Säg mängden ${what} i liter eller kilo, till exempel "${amount * 10} l", eller förpackningsstorleken.`,
    oneAtATime: (what) => `Jag beställer en produkt åt gången. Vilken först, och hur mycket: ${what}?`,
    offTask: "Jag kan bara söka produkter, få ett signerat pris och beställa till ert kök. En person godkänner beställningar och sätter gränserna.",
    howMuch: (what) => `Hur mycket ${what} behöver du, och till vilken dag?`,
    tooSmall: (what) => `Mängden är för liten att beställa. Hur mycket ${what} behöver du?`,
  },
};

/** A phrase joining two product words: "butter and cream", "voita ja kermaa", "smör och grädde". */
const TWO_PRODUCTS = /\s\p{L}{2,}\s+(and|och|ja|sekä|samt|&)\s+\p{L}{2,}/iu;

/** Words that ask the agent to do what only a person may: approve, change limits, ignore the rules. */
const OFF_TASK = /\b(approve (it|all|everything|the order|orders) (yourself|now|for me)|approve everything|ignore (your|the|all|my) (rules|instructions|limits|mandate)|bypass|override (the|your) (rules|limits?)|raise (my|the|your) limits?|change (my|the|your) (limits?|mandate)|ohita säännöt|nosta rajaa?|hyväksy kaikki|ignorera reglerna|godkänn allt)\b/iu;

/**
 * The buyer's purchasing agent: read the request, find the cheapest product that covers it, get a signed
 * offer, and place one order under the mandate. It never retries after a block or while waiting for a person.
 */
export async function runPurchase(
  requestText: string,
  transport: AgentTransport,
  hooks: AgentHooks,
  options: PurchaseOptions = {},
): Promise<PurchaseResult> {
  const steps: PurchaseStep[] = [];
  const say = async (text: string, status: NoteStatus = "ok") => {
    steps.push({ text, status });
    await hooks.note(text, status);
  };
  const finish = async (status: PurchaseStatus, summary: string, extra: Partial<PurchaseResult> = {}, noteStatus?: NoteStatus) => {
    if (noteStatus) await say(summary, noteStatus);
    return { status, summary, steps, ...extra };
  };

  let parsed: ParsedRequest | undefined;
  try {
    const read = parseRequest(requestText, now());
    parsed = options.productId ? { ...read, productId: options.productId } : read;
    const what = parsed.phrase || (parsed.productId ? `product ${parsed.productId}` : "the product");
    const lang = languageOf(requestText);
    if (OFF_TASK.test(requestText)) return finish("needs_input", ASK[lang].offTask, {}, "waiting");
    if (!parsed.phrase && !parsed.productId) return finish("needs_input", ASK[lang].which, {}, "waiting");
    // "smör och grädde": two products in one phrase would be searched as one. Ask which first instead of guessing.
    if (TWO_PRODUCTS.test(` ${parsed.phrase} `)) return finish("needs_input", ASK[lang].oneAtATime(parsed.phrase), {}, "waiting");
    if (!parsed.quantity) return finish("needs_input", ASK[lang].howMuch(what), {}, "waiting");
    if (parsed.quantity.amount <= 0) return finish("needs_input", ASK[lang].tooSmall(what), {}, "waiting");
    // "Two boxes of cream": a box could be a 250 g spray or a 20 l bag. Ask instead of picking the cheapest pack.
    if (parsed.packageWord) return finish("needs_input", ASK[lang].packSize(parsed.quantity.amount, parsed.packageWord, what), {}, "waiting");
    const quantity = parsed.quantity;
    const by = `by ${shortDay(parsed.deliverBy)}${parsed.deliverByStated ? "" : " (next working day)"}`;
    await say(`Looking for ${what}, ${quantityText(quantity)}, ${by}.`);
    await hooks.pause();

    // The mandate first: the search leaves out what it never allows, so the agent finds what the kitchen may have.
    const { jws: mandateJws, mandate } = await transport.getMandate();
    const candidates = await findCandidates(parsed, transport, mandate.dietary);
    if (candidates.products.length === 0) {
      const why = candidates.matches > 0 ? " The matches are sold in another unit." : "";
      return finish("not_found", `Found nothing that matches "${what}".${why} No order placed.`, {}, "error");
    }
    if (candidates.confidence === "low") await say(`The match is uncertain. ${candidates.note ?? ""}`.trim(), "waiting");
    await hooks.pause();

    const selection = await selectOffer({
      parsed: { ...parsed, quantity },
      products: candidates.products,
      hits: candidates.hits,
      confidence: candidates.confidence,
      transport,
      say: (text) => say(text),
      pause: () => hooks.pause(),
    });
    if ("failure" in selection) return finish("failed", `${selection.failure} No order placed.`, {}, "error");
    const { offer, jws } = selection.signed;
    await say(`Offer signed by ${offer.issuer}: ${offerSubject(offer)}, ${euro(offer.totals.gross.amount)} with VAT. Valid ${validMinutes(offer)} minutes.`);
    await hooks.pause();

    const order = await transport.placeOrder({ offerJws: jws, mandateJws, idempotencyKey: randomUUID() });
    const result = outcome(order, mandate);
    const noteStatus: NoteStatus = result.status === "confirmed" ? "ok" : result.status === "waiting" ? "waiting" : "blocked";
    await say(result.note, noteStatus);
    return finish(result.status, result.summary, { orderId: order.id, offerId: offer.id });
  } catch (error) {
    // A refused quote is the buyer's request to restate, not a fault: say why in their terms.
    const refusal = parsed ? quoteRefusal(error, parsed) : undefined;
    if (refusal) return finish("needs_input", `${refusal} No order placed.`, {}, "blocked");
    const message = error instanceof Error ? error.message : String(error);
    return finish("failed", `Something went wrong: ${message} No order placed.`, {}, "error");
  }
}
