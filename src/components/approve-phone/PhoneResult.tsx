import { CircleCheck, CircleX, Clock3 } from "lucide-react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { blockedLine } from "@/lib/console/format/rules";
import { day, hourMinute } from "@/lib/console/format/time";
import { deadline, type OrderPhase } from "./phone-order";

interface PhoneResultProps {
  order: Order;
  state: Exclude<OrderPhase, "pending">;
  entry?: AuditEntry;
  /** The person approved, but the re-check at approval stopped the order. */
  stopped?: boolean;
}

function view({ order, state, stopped }: PhoneResultProps): { tone: "success" | "neutral" | "danger"; word: string; line: string } {
  if (order.refusal) return { tone: "danger", word: "Refused", line: order.refusal.message };
  const reason = blockedLine(order).replace(/^Blocked\.\s*/, "");
  if (stopped) return { tone: "danger", word: "Not ordered", line: `It changed while it waited. ${reason} Nothing was ordered.` };
  if (state === "blocked") return { tone: "danger", word: "Blocked by your limits", line: reason };
  if (state === "expired") {
    return {
      tone: "neutral",
      word: "The offer expired",
      line: `Valio Aimo’s price held until ${hourMinute(deadline(order))}. Nothing was ordered. The agent can ask for a new offer.`,
    };
  }
  if (order.status === "confirmed") {
    const arrives = order.offer.deliveryDate ? ` It arrives ${day(order.offer.deliveryDate)}.` : "";
    return { tone: "success", word: "Approved", line: `Valio Aimo has the order for ${eur(order.offer.totals.net.amount)} net.${arrives}` };
  }
  const note = order.approval?.note ? ` Reason: ${order.approval.note}` : "";
  return { tone: "neutral", word: "Rejected", line: `Nothing was ordered.${note}` };
}

/** After the decision: what happened, who signed it and where it sits in the log. */
export function PhoneResult(props: PhoneResultProps) {
  const { order, entry } = props;
  const { tone, word, line } = view(props);
  const Icon = tone === "success" ? CircleCheck : tone === "danger" ? CircleX : Clock3;
  const signer = order.approval ? "Purchasing manager" : undefined;

  return (
    <div className="ph-result" data-tone={tone} role="status">
      <Icon className="ph-result-icon" aria-hidden="true" />
      <h1 className="ph-result-word">{word}</h1>
      <p className="ph-result-line">{line}</p>
      {signer ? (
        <p className="ph-signed">
          Decided by the {signer.toLowerCase()}
          {entry ? ` · step ${entry.seq} in the record` : " · saving to the record…"}
        </p>
      ) : null}
    </div>
  );
}
