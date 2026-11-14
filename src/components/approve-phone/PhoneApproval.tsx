"use client";

import { ChevronRight, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Alternative, Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { offerSubject } from "@/lib/console/format/proof";
import { shortName } from "@/lib/console/format/rules";
import { day, dayAndTime, hourMinute } from "@/lib/console/format/time";
import { sharedLocked } from "@/lib/console/format/workspace";
import { useConsole } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { SharedLock } from "../session/SharedLock";
import { DockMark, Wordmark } from "../shell/Wordmark";
import { useNow } from "../ui/useNow";
import { decisionEntry, orderPhase, phoneChecks, phoneReason, timeLeft } from "./phone-order";
import { PhoneDecide } from "./PhoneDecide";
import { PhoneResult } from "./PhoneResult";
import { PhoneSignIn } from "./PhoneSignIn";

export interface PhoneApprovalProps {
  orderId: string;
  /** Shown inside the walkthrough's phone frame: links that would leave the story are left out. */
  embedded: boolean;
}

/** No such order in this browser's workspace: the brand, one plain sentence and the way back. */
function PhoneMissing({ embedded }: { embedded: boolean }) {
  return (
    <main className="ph ph-missing" data-embedded={embedded}>
      <Wordmark />
      <div className="ph-empty" role="status">
        <SearchX className="ph-empty-icon" aria-hidden="true" />
        <h1>We could not find this order</h1>
        <p>It may have been decided already, or your demo was reset since the link was made.</p>
        {!embedded ? (
          <Link className="btn btn-primary big" href="/buyer">
            Go to the buyer side
          </Link>
        ) : null}
      </div>
    </main>
  );
}

/** While the order loads, the card keeps its shape so nothing jumps when it arrives. */
function PhoneLoading({ embedded }: { embedded: boolean }) {
  return (
    <main className="ph" data-embedded={embedded} aria-busy="true">
      <header className="ph-top">
        <DockMark size={20} />
        <span className="ph-bone" style={{ width: 160 }} />
      </header>
      <div className="ph-card">
        <span className="ph-bone" style={{ width: 120 }} />
        <span className="ph-bone ph-bone-big" style={{ width: 200 }} />
        <span className="ph-bone ph-bone-big" style={{ width: 160 }} />
      </div>
      <p className="sr-only">Loading the order…</p>
    </main>
  );
}

/** The buyer's words against the offer, as Valio Aimo signed them; a substitute shows the rule that allowed it. */
function PhoneChecks({ order }: { order: Order }) {
  const checks = phoneChecks(order);
  if (checks.length === 0) return null;
  return (
    <section className="ph-checks" aria-labelledby="ph-checks-title">
      <h2 id="ph-checks-title">Checked against your words</h2>
      <ul>
        {checks.map((check) => (
          <li key={`${check.label}-${check.asked}`} data-result={check.result}>
            <span className="ph-check-head">
              <span className="ph-check-label">{check.label}</span>
              <span className="ph-check-word">{check.word}</span>
            </span>
            <span className="ph-check-line">
              Asked {check.asked} · delivered {check.offered}
            </span>
            {check.rule ? <span className="ph-check-rule">{check.rule}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** After an approval the re-check stopped: what Valio Aimo offers instead, for the agent to order. */
function PhoneAlternatives({ alternatives }: { alternatives: Alternative[] }) {
  return (
    <section className="ph-alts" aria-labelledby="ph-alts-title">
      <h2 id="ph-alts-title">{alternatives.length ? "Valio Aimo offers instead" : "No alternative in stock"}</h2>
      {alternatives.length ? (
        <>
          <ul>
            {alternatives.map((alt) => (
              <li key={alt.signed.offer.id}>
                <span className="ph-alt-what">{offerSubject(alt.signed.offer)}</span>
                <span className="ph-alt-why">{alt.tradeoff}</span>
                <span className="ph-alt-net">{eur(alt.signed.offer.totals.net.amount)} net</span>
              </li>
            ))}
          </ul>
          <p className="ph-fine">Your agent can order one of these as a new order.</p>
        </>
      ) : (
        <p className="ph-fine">Your agent can ask again later.</p>
      )}
    </section>
  );
}

/**
 * One order on the approver's phone: who asks, why it stopped, the amount, the request against the offer,
 * and the two choices under the thumb. Every decision is signed with the approver's key and logged.
 */
export function PhoneApproval({ orderId, embedded }: PhoneApprovalProps) {
  const { orders, audit, session, mandate, chain, ready } = useConsole();
  const workspace = useWorkspace();
  const now = useNow(1000);
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const order = orders.find((item) => item.id === orderId);
  const approver = shortName(session?.approver?.name ?? mandate?.mandate.approval.approver.name ?? "the approver");

  if (sharedLocked(workspace, session)) {
    return (
      <main className="ph" data-embedded={embedded}>
        <SharedLock role="approver" />
      </main>
    );
  }
  if (!order) return ready ? <PhoneMissing embedded={embedded} /> : <PhoneLoading embedded={embedded} />;

  const state = orderPhase(order, now);
  const hold = order.priceHold;
  const left = hold ? undefined : timeLeft(order.offer.expiresAt, now);
  const signedIn = session?.signedIn === true;

  return (
    <main className="ph" data-embedded={embedded}>
      <header className="ph-top">
        <DockMark size={20} />
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
          <PhoneResult order={order} state={state} entry={decisionEntry(audit, order.id)} stopped={alternatives !== null} />
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
          <div>
            <dt>With VAT</dt>
            <dd>{eur(order.offer.totals.gross.amount)}</dd>
          </div>
          {state === "pending" ? (
            <div>
              <dt>{hold ? "Price held until" : "Price fixed until"}</dt>
              <dd>
                {hold ? dayAndTime(hold.heldUntil) : hourMinute(order.offer.expiresAt)}
                {left ? <span className="ph-left"> · {left} left</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
        <PhoneChecks order={order} />
      </article>

      {alternatives ? <PhoneAlternatives alternatives={alternatives} /> : null}

      {state === "pending" ? (
        <div className="ph-dock">
          {!session ? null : signedIn ? (
            <PhoneDecide order={order} paused={chain.state === "broken"} approver={approver} demo={session.demo === true} onStopped={setAlternatives} />
          ) : (
            <PhoneSignIn session={session} approver={approver} />
          )}
        </div>
      ) : null}

      {!embedded ? (
        <Link className="text-link ph-full" href="/buyer/orders">
          See every order on the buyer side
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : null}
    </main>
  );
}
