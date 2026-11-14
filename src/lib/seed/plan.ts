import type { ApprovalDecisionRequest, Quantity } from "@/lib/contracts";
import { SCRIPTED_CLIENT } from "@/lib/http/client-app";
import { BUYER_IDS } from "@/lib/mandate/defaults";

/** When a seeded request starts: a Helsinki time on one of the last working days, or minutes before now. */
export type SeedTime = { workingDaysAgo: number; at: string } | { minutesAgo: number };

/** One buyer request as the seed plays it through the gateway: search, quote, and optionally order and decide. */
export interface SeedRequest {
  buyer: string;
  client: string;
  when: SeedTime;
  /** The buyer's words, kept as the quote's intent. */
  words: string;
  /** What the agent searched for. */
  query: string;
  quantity: Quantity;
  /** The product the agent chose; the best search hit when not given. */
  productId?: string;
  /** Asked after the order cut-off for the next working day had passed. */
  missCutoff?: boolean;
  /**
   * Delivery a week ahead. The wholesaler holds the offer's price until that date's order cut-off and says so in the
   * signed expiry, so an order waiting for approval can still be decided while the demo runs.
   */
  weekAhead?: boolean;
  /** Which signed offer the agent orders: the offer as asked, or the wholesaler's first alternative. */
  order?: "primary" | "alternative";
  /** The approver's decision, when the order waits for one. */
  decision?: ApprovalDecisionRequest & { afterMinutes: number };
}

const { nordicHarbour: HARBOUR, kaisla: KAISLA, laine: LAINE } = BUYER_IDS;

const litres = (amount: number): Quantity => ({ amount, unit: "l" });
const kilos = (amount: number): Quantity => ({ amount, unit: "kg" });

/** Arla lactose-free fat-free UHT milk drink: 51 units in the recording, so larger requests get a counter-offer. */
const ARLA_UHT_MILK = "462775";
/** Arla lactose-free whipping cream ESL: 37 units in the recording. */
const ARLA_WHIPPING_CREAM = "464727";
/** Alpro almond drink: contains nuts. */
const ALMOND_DRINK = "461360";
/** Dafgårds ciabatta: may contain sesame. */
const CIABATTA = "471464";
/** Kalavapriikki pike-perch fillet, sold in lots of 3 kg. */
const PIKE_PERCH = "461886";

/**
 * About a week of trade by three buyers, weekday mornings mostly. Nordic Harbour's confirmed spend stays well under
 * its weekly limit, so the console's scenes behave as on an empty week, and none of its orders is left waiting.
 */
export const SEED_REQUESTS: SeedRequest[] = [
  // Nordic Harbour Hotels: breakfast buffets, a scripted agent and Claude Code.
  { buyer: HARBOUR, client: SCRIPTED_CLIENT, when: { workingDaysAgo: 5, at: "07:42" },
    words: "400 litres of lactose-free milk for the breakfast buffets", query: "lactose-free milk", quantity: litres(400), order: "primary" },
  { buyer: HARBOUR, client: "Claude Code", when: { workingDaysAgo: 5, at: "08:16" },
    words: "60 kg of butter for the kitchens", query: "butter", quantity: kilos(60), order: "primary" },
  { buyer: HARBOUR, client: SCRIPTED_CLIENT, when: { workingDaysAgo: 4, at: "07:55" },
    words: "120 kg of potatoes by tomorrow", query: "potatoes", quantity: kilos(120), order: "primary" },
  { buyer: HARBOUR, client: "Claude Code", when: { workingDaysAgo: 4, at: "09:24" },
    words: "200 litres of Arla lactose-free UHT milk", query: "Arla lactose-free UHT milk", quantity: litres(200),
    productId: ARLA_UHT_MILK, order: "alternative" },
  { buyer: HARBOUR, client: SCRIPTED_CLIENT, when: { workingDaysAgo: 3, at: "08:31" },
    words: "40 litres of Arla whipping cream for the weekend brunch", query: "whipping cream", quantity: litres(40),
    productId: ARLA_WHIPPING_CREAM, order: "primary",
    decision: { decision: "approved", note: "37 litres is enough for the brunch.", afterMinutes: 6 } },
  { buyer: HARBOUR, client: "Claude Code", when: { workingDaysAgo: 3, at: "16:42" },
    words: "300 litres of lactose-free milk for tomorrow", query: "lactose-free milk", quantity: litres(300),
    missCutoff: true },
  { buyer: HARBOUR, client: "Claude Code", when: { workingDaysAgo: 2, at: "08:20" },
    words: "40 litres of almond drink for the vegan breakfast", query: "almond drink", quantity: litres(40),
    productId: ALMOND_DRINK, order: "primary" },
  { buyer: HARBOUR, client: SCRIPTED_CLIENT, when: { workingDaysAgo: 2, at: "09:35" },
    words: "20 kg of grated cheese", query: "grated cheese", quantity: kilos(20), order: "primary" },
  { buyer: HARBOUR, client: SCRIPTED_CLIENT, when: { workingDaysAgo: 1, at: "08:05" },
    words: "36 kg of eggs for the breakfast buffets", query: "eggs", quantity: kilos(36), order: "primary" },
  { buyer: HARBOUR, client: "ChatGPT", when: { workingDaysAgo: 1, at: "09:12" },
    words: "vegan feta 10 kg", query: "vegan feta", quantity: kilos(10) },

  // Kaisla School Kitchens: school lunches, planned in ChatGPT and Cursor.
  { buyer: KAISLA, client: "ChatGPT", when: { workingDaysAgo: 5, at: "07:30" },
    words: "300 litres of lactose-free milk for school lunches", query: "lactose-free milk", quantity: litres(300), order: "primary" },
  { buyer: KAISLA, client: "ChatGPT", when: { workingDaysAgo: 5, at: "08:44" },
    words: "100 kg of carrots for the soup day", query: "carrots", quantity: kilos(100), order: "primary" },
  { buyer: KAISLA, client: "Cursor", when: { workingDaysAgo: 4, at: "07:38" },
    words: "20 kg of ciabatta rolls for the Friday lunch", query: "ciabatta", quantity: kilos(20),
    productId: CIABATTA, order: "primary" },
  { buyer: KAISLA, client: "Cursor", when: { workingDaysAgo: 4, at: "08:12" },
    words: "150 kg of oat flakes for breakfast porridge", query: "oat flakes", quantity: kilos(150), order: "primary" },
  { buyer: KAISLA, client: "ChatGPT", when: { workingDaysAgo: 3, at: "07:50" },
    words: "800 litres of lactose-free milk for the whole district", query: "lactose-free milk", quantity: litres(800), order: "primary",
    decision: { decision: "approved", note: "Covers all eleven schools this week.", afterMinutes: 9 } },
  { buyer: KAISLA, client: "Cursor", when: { workingDaysAgo: 3, at: "08:35" },
    words: "40 kg of salmon fillet for Thursday", query: "salmon fillet", quantity: kilos(40), order: "primary",
    decision: { decision: "approved", note: "Checked with the wholesaler: plain salmon, fish only.", afterMinutes: 8 } },
  { buyer: KAISLA, client: "ChatGPT", when: { workingDaysAgo: 2, at: "07:58" },
    words: "gluten-free rye bread 40 kg", query: "gluten-free rye bread", quantity: kilos(40) },
  { buyer: KAISLA, client: "Cursor", when: { workingDaysAgo: 2, at: "08:47" },
    words: "25 kg of grated cheese for the pasta bake", query: "grated cheese", quantity: kilos(25), order: "primary" },
  { buyer: KAISLA, client: "ChatGPT", when: { workingDaysAgo: 1, at: "07:36" },
    words: "50 litres of Arla whipping cream for the dessert day", query: "whipping cream", quantity: litres(50),
    productId: ARLA_WHIPPING_CREAM },
  { buyer: KAISLA, client: "Cursor", when: { workingDaysAgo: 1, at: "16:35" },
    words: "60 kg of chicken fillet for tomorrow", query: "chicken fillet", quantity: kilos(60), missCutoff: true },
  { buyer: KAISLA, client: "ChatGPT", when: { minutesAgo: 4 },
    words: "900 litres of lactose-free milk for next week", query: "lactose-free milk", quantity: litres(900), order: "primary",
    weekAhead: true },

  // Ravintola Laine: a 60-seat restaurant, from Claude and a curl script.
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 5, at: "10:05" },
    words: "20 litres of cooking cream", query: "cooking cream", quantity: litres(20), order: "primary",
    decision: { decision: "approved", afterMinutes: 12 } },
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 5, at: "10:32" },
    words: "10 kg of salmon fillet for the weekend menu", query: "salmon fillet", quantity: kilos(10), order: "primary",
    decision: { decision: "approved", note: "Good price, keep this one.", afterMinutes: 7 } },
  { buyer: LAINE, client: "curl", when: { workingDaysAgo: 4, at: "10:14" },
    words: "lingonberry jam 20 kg", query: "lingonberry jam", quantity: kilos(20) },
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 4, at: "10:41" },
    words: "40 litres of Arla whipping cream", query: "whipping cream", quantity: litres(40),
    productId: ARLA_WHIPPING_CREAM, order: "alternative" },
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 3, at: "10:18" },
    words: "20 litres of cooking cream", query: "cooking cream", quantity: litres(20), order: "primary" },
  { buyer: LAINE, client: "curl", when: { workingDaysAgo: 3, at: "11:02" },
    words: "8 kg of pike-perch fillet", query: "pike-perch fillet", quantity: kilos(8), productId: PIKE_PERCH, order: "primary",
    decision: { decision: "approved", afterMinutes: 11 } },
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 2, at: "10:09" },
    words: "450 litres of lactose-free milk", query: "lactose-free milk", quantity: litres(450), order: "primary",
    decision: { decision: "rejected", note: "Far too much for us. Ask me before ordering milk in bulk.", afterMinutes: 5 } },
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 2, at: "16:20" },
    words: "15 kg of cheddar slices for tomorrow's burgers", query: "cheddar slices", quantity: kilos(15), missCutoff: true },
  { buyer: LAINE, client: "curl", when: { workingDaysAgo: 1, at: "10:01" },
    words: "20 litres of rapeseed oil", query: "rapeseed oil", quantity: litres(20), order: "primary",
    decision: { decision: "approved", afterMinutes: 4 } },
  { buyer: LAINE, client: "Claude", when: { workingDaysAgo: 1, at: "10:26" },
    words: "10 litres of cooking cream", query: "cooking cream", quantity: litres(10), order: "primary" },
];
