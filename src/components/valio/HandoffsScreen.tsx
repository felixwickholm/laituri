"use client";

import { LogIn } from "lucide-react";
import { useMemo, useRef } from "react";
import { OPERATOR_SIGN_IN_REQUIRED } from "@/lib/console/api";
import { count } from "@/lib/console/format/money";
import { handoffsHeadline, sortHandoffs } from "@/lib/supplier-console/handoffs";
import { handoffsPoller, useBaskets, useHandoffs } from "@/lib/supplier-console/hooks";
import { requestSignIn } from "../session/gate";
import { BlockNote, ValioHead } from "./bits";
import { HandoffCard } from "./HandoffCard";

/** The wholesaler's inbox: questions kitchens sent when they wanted a person, open ones first. */
export function HandoffsScreen() {
  const { data, error, code, locked } = useHandoffs();
  const { data: baskets } = useBaskets();
  const signInRef = useRef<HTMLButtonElement>(null);
  const handoffs = useMemo(() => sortHandoffs(data ?? []), [data]);
  const open = handoffs.filter((handoff) => handoff.status === "open").length;
  const needsOperator = code === OPERATOR_SIGN_IN_REQUIRED && !data;

  async function signIn() {
    if (await requestSignIn(signInRef.current, "demo", "operator")) void handoffsPoller.refresh();
  }

  return (
    <div className="page control-page">
      <ValioHead title="Questions" date={data ? `${count(open)} open · ${count(handoffs.length - open)} answered` : undefined} />
      {data ? (
        <section className="glass pad week-card" aria-labelledby="questions-verdict">
          <div className="verdict">
            <p className="verdict-label">From customers</p>
            <h2 className="verdict-title" id="questions-verdict">
              {handoffsHeadline(handoffs)}
            </h2>
          </div>
        </section>
      ) : null}
      {locked ? null : needsOperator ? (
        <div className="empty-state">
          <LogIn aria-hidden="true" />
          <p>Operator sign-in needed.</p>
          <button ref={signInRef} type="button" className="btn btn-primary" onClick={() => void signIn()}>
            Sign in
          </button>
        </div>
      ) : !data ? (
        <BlockNote>{error ? "The questions could not be loaded. Trying again." : "Loading…"}</BlockNote>
      ) : handoffs.length === 0 ? null : (
        <div className="questions">
          {handoffs.map((handoff) => (
            <HandoffCard key={handoff.id} handoff={handoff} baskets={baskets ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
