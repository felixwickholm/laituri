"use client";

import { CircleCheck, Clock } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { Basket, Handoff } from "@/lib/contracts";
import { dayAndTime } from "@/lib/console/format/time";
import { supplierApi } from "@/lib/supplier-console/api";
import { handoffContext, toldKitchen } from "@/lib/supplier-console/handoffs";
import { handoffsPoller } from "@/lib/supplier-console/hooks";
import { withOperator } from "../session/gate";
import { StateWord } from "../ui/StateWord";

/** One kitchen's question: who, when, their words, what the system attached, and the operator's answer. */
export function HandoffCard({ handoff, baskets }: { handoff: Handoff; baskets: Basket[] }) {
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const root = useRef<HTMLFormElement>(null);
  const told = toldKitchen(handoff);
  const open = handoff.status === "open";

  async function answer() {
    setBusy(true);
    setError(null);
    try {
      const saved = await withOperator(root.current, () => supplierApi.answer(handoff.id, words.trim()));
      if (saved) {
        setWords("");
        void handoffsPoller.refresh();
      }
    } catch {
      setError("Your answer was not sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card question" data-status={handoff.status} aria-labelledby={`${fieldId}-who`}>
      <header className="question-head">
        <div>
          <h2 id={`${fieldId}-who`} className="question-who">
            {handoff.buyer.name}
          </h2>
          <p className="question-meta">
            {handoff.from} · <time dateTime={handoff.at}>{dayAndTime(handoff.at)}</time>
          </p>
        </div>
        <StateWord word={open ? "Open" : "Answered"} tone={open ? "waiting" : "success"} />
      </header>
      <blockquote className="question-words">{handoff.words}</blockquote>
      <dl className="question-context">
        {handoffContext(handoff, baskets).map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {told && open ? (
        <p className="question-told">
          <Clock aria-hidden="true" />
          <span>
            <strong>The customer was told:</strong> {told}
          </span>
        </p>
      ) : null}
      {handoff.answer ? (
        <div className="question-answer">
          <CircleCheck aria-hidden="true" />
          <div>
            <p className="question-answer-words">{handoff.answer.words}</p>
            <p className="question-meta">
              {handoff.answer.by} · <time dateTime={handoff.answer.at}>{dayAndTime(handoff.answer.at)}</time>
            </p>
          </div>
        </div>
      ) : (
        <form
          ref={root}
          className="question-form"
          onSubmit={(event) => {
            event.preventDefault();
            void answer();
          }}
        >
          <label className="field-label" htmlFor={fieldId}>
            Your answer to the customer
          </label>
          <textarea
            id={fieldId}
            className="text-field text-area"
            rows={3}
            maxLength={1000}
            value={words}
            onChange={(event) => setWords(event.target.value)}
            placeholder="For example: Yes, oat cream works. I added it to Monday."
          />
          <div className="question-actions">
            {error ? (
              <p className="question-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={busy || words.trim().length === 0}>
              {busy ? "Sending…" : "Send answer"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
