import { CircleCheck, CircleX, Clock3 } from "lucide-react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { blockedLine, shortName } from "@/lib/console/format/rules";
import { day, hourMinute } from "@/lib/console/format/time";
import type { OrderPhase } from "./phone-order";

interface PhoneResultProps {
  order: Order;
  state: Exclude<OrderPhase, "pending">;
  entry?: AuditEntry;
}

function view({ order, state }: PhoneResultProps): { tone: "success" | "neutral" | "danger"; word: string; line: string } {
  if (state === "blocked") return { tone: "danger", word: "Blocked by the rules", line: blockedLine(order).replace(/^Blocked\.\s*/, "") };
  if (state === "expired") {
    return {
      tone: "neutral",
      word: "The offer expired",
      line: `Valio Aimo’s price held until ${hourMinute(order.offer.expiresAt)}. Nothing was ordered. The agent can ask for a new offer.`,
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
  const signer = order.approval ? shortName(order.approval.decidedBy.name) : undefined;

  return (
    <div className="ph-result" data-tone={tone} role="status">
      <Icon className="ph-result-icon" aria-hidden="true" />
      <h1 className="ph-result-word">{word}</h1>
      <p className="ph-result-line">{line}</p>
      {signer ? (
        <p className="ph-signed">
          Signed by {signer}
          {entry ? ` · logged as entry ${entry.seq}` : " · writing to the log…"}
        </p>
      ) : null}
    </div>
  );
}
