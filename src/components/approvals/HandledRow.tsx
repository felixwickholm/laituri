import type { Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { askReasons, blockSentence, handledState, shortName } from "@/lib/console/format/rules";
import { StateWord, type StateTone } from "../ui/StateWord";

/** "Maria Lind approved", "Approved automatically", "Blocked by the mandate". */
export function decidedBy(order: Order): { word: string; tone: StateTone; why: string } {
  const state = handledState(order);
  const who = shortName(order.approval?.decidedBy.name ?? "A person");
  switch (state) {
    case "blocked": {
      const block = order.decision.checks.find((check) => check.status === "block");
      return { word: "Blocked by the mandate", tone: "danger", why: block ? blockSentence(block) : "The order is outside the mandate." };
    }
    case "approved":
      return { word: `${who} approved`, tone: "success", why: askReasons(order)[0] ?? "A person signed off." };
    case "rejected":
      return { word: `${who} rejected`, tone: "neutral", why: askReasons(order)[0] ?? "A person said no." };
    case "expired":
      return { word: "Expired before a decision", tone: "neutral", why: "The fixed price ran out while it waited." };
    default:
      return { word: "Approved automatically", tone: "success", why: `Inside the mandate. All ${order.decision.checks.length} checks passed.` };
  }
}

/** A decided order: who decided, the amount, what it was, and one line on why. */
export function HandledRow({ order, onOpen }: { order: Order; onOpen: (orderId: string) => void }) {
  const view = decidedBy(order);
  const what = order.offer.intent?.trim() || order.offer.lines.map((line) => line.name).join(", ");
  return (
    <li>
      <button type="button" className="handled" onClick={() => onOpen(order.id)}>
        <span className="handled-state">
          <StateWord word={view.word} tone={view.tone} />
        </span>
        <span className="amount mono">{eur(order.offer.totals.net.amount)}</span>
        <span className="what">{what}</span>
        <span className="why">{view.why}</span>
      </button>
    </li>
  );
}
