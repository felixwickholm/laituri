"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { eur } from "@/lib/console/format/money";
import { offerSubject } from "@/lib/console/format/proof";
import { shortName } from "@/lib/console/format/rules";
import { day, hourMinute } from "@/lib/console/format/time";
import { useConsole } from "@/lib/console/store";
import { PierMark } from "../shell/Wordmark";
import { useNow } from "../ui/useNow";
import { decisionEntry, orderPhase, phoneReason, timeLeft } from "./phone-order";
import { PhoneDecide } from "./PhoneDecide";
import { PhoneResult } from "./PhoneResult";
import { PhoneSignIn } from "./PhoneSignIn";

export interface PhoneApprovalProps {
  orderId: string;
  /** Shown inside the walkthrough's phone frame: links that would leave the story are left out. */
  embedded: boolean;
}

/**
 * One order on the approver's phone: who asks, why it stopped, the amount, the request against the offer,
 * and two full-width choices. Every decision is signed with the approver's key and logged.
 */
export function PhoneApproval({ orderId, embedded }: PhoneApprovalProps) {
  const { orders, audit, session, mandate, chain, ready } = useConsole();
  const now = useNow(1000);
  const order = orders.find((item) => item.id === orderId);
  const approver = shortName(mandate?.mandate.approval.approver.name ?? "the approver");

  if (!order) {
    return (
      <main className="ph" data-embedded={embedded}>
        <div className="ph-empty" role="status">
          <h1>{ready ? "This order was not found" : "Loading the order…"}</h1>
          {ready ? <p>It may belong to another buyer, or the demo was reset since the link was sent.</p> : null}
          {ready && !embedded ? (
            <Link className="ph-link" href="/buyer">
              Open the buyer console
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  const state = orderPhase(order, now);
  const left = timeLeft(order.offer.expiresAt, now);
  const signedIn = session?.signedIn === true;

  return (
    <main className="ph" data-embedded={embedded}>
      <header className="ph-top">
        <PierMark size={20} />
        <div>
          <p className="ph-buyer">{order.buyer.name}</p>
          <p className="ph-agent">{order.agent.name}</p>
        </div>
      </header>

      <article className="ph-card" aria-labelledby="ph-title">
        {state === "pending" ? (
          <>
            <p className="ph-pill">Needs your approval</p>
            <h1 id="ph-title" className="ph-reason-line">
              {phoneReason(order)}
            </h1>
            <p className="ph-amount">
              {eur(order.offer.totals.net.amount)} <span>net</span>
            </p>
          </>
        ) : (
          <PhoneResult order={order} state={state} entry={decisionEntry(audit, order.id)} />
        )}

        <dl className="ph-facts">
          <div>
            <dt>Asked</dt>
            <dd>{order.offer.intent ?? "–"}</dd>
          </div>
          <div>
            <dt>Offered</dt>
            <dd>{offerSubject(order.offer)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{day(order.offer.deliveryDate)}</dd>
          </div>
          {state === "pending" ? (
            <div>
              <dt>Price fixed until</dt>
              <dd>
                {hourMinute(order.offer.expiresAt)}
                {left ? <span className="ph-left"> · {left} left</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </article>

      {state === "pending" ? (
        <div className="ph-dock">
          {signedIn ? <PhoneDecide order={order} paused={chain.state === "broken"} /> : <PhoneSignIn session={session} approver={approver} />}
        </div>
      ) : null}

      {!embedded ? (
        <Link className="ph-link ph-full" href="/buyer/orders">
          See every order in the buyer console
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : null}
    </main>
  );
}
