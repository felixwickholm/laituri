"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Alternative, Order } from "@/lib/contracts";
import { eur } from "@/lib/console/format/money";
import { offerSubject } from "@/lib/console/format/proof";
import { day, dayAndTime, hourMinute } from "@/lib/console/format/time";
import { sharedLocked } from "@/lib/console/format/workspace";
import { useConsole } from "@/lib/console/store";
import { useWorkspace } from "@/lib/console/workspace-store";
import { SharedLock } from "../session/SharedLock";
import { DockMark } from "../shell/Wordmark";
import { useNow } from "../ui/useNow";
import { decisionEntry, orderPhase, phoneChecks, phoneReason, timeLeft, type PhoneCheck } from "./phone-order";
import { PhoneDecide } from "./PhoneDecide";
import { PhoneResult } from "./PhoneResult";
import { PhoneSignIn } from "./PhoneSignIn";
import { PhoneLoading, PhoneMissing } from "./PhoneStates";

export interface PhoneApprovalProps {
  orderId: string;
  /** Shown inside the walkthrough's phone frame: links that would leave the story are left out. */
  embedded: boolean;
}

/** The buyer's words against the offer, as Valio Aimo signed them; a substitute shows the rule that allowed it. */
function CheckRows({ checks }: { checks: PhoneCheck[] }) {
  return (
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
  );
}

/** What did not match stays in view; what matched folds away behind its count. */
function PhoneChecks({ order }: { order: Order }) {
  const checks = phoneChecks(order);
  if (checks.length === 0) return null;
  const open = checks.filter((check) => check.result !== "met");
  const met = checks.filter((check) => check.result === "met");
  return (
    <section className="ph-checks" aria-labelledby="ph-checks-title">
      <h2 id="ph-checks-title">Your words</h2>
      {open.length ? <CheckRows checks={open} /> : null}
      {met.length ? (
        <details className="ph-met">
          <summary>{met.length} match</summary>
          <CheckRows checks={met} />
        </details>
      ) : null}
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
  const { orders, audit, session, chain, ready } = useConsole();
  const workspace = useWorkspace();
  const now = useNow(1000);
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const order = orders.find((item) => item.id === orderId);

  if (sharedLocked(workspace, session)) {
    return (
      <main className="ph" data-embedded={embedded}>
        <SharedLock role="approver" />
      </main>
    );
  }
  if (!order) return ready ? <PhoneMissing embedded={embedded} what="order" /> : <PhoneLoading embedded={embedded} />;

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

      <article className="ph-card glass" aria-labelledby="ph-title">
        {state === "pending" ? (
          <>
            <p className="ph-pill">Needs you</p>
            <p className="ph-amount">
              {eur(order.offer.totals.net.amount)} <span>net</span>
            </p>
            <h1 id="ph-title" className="ph-reason-line">
              {phoneReason(order)}
            </h1>
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
          {state === "pending" ? (
            <div>
              <dt>{hold ? "Price held" : "Price fixed"}</dt>
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
            <PhoneDecide order={order} paused={chain.state === "broken"} onStopped={setAlternatives} />
          ) : (
            <PhoneSignIn session={session} />
          )}
        </div>
      ) : null}

      {!embedded ? (
        <Link className="text-link ph-full" href="/buyer/orders">
          See every order
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : null}
    </main>
  );
}
