"use client";

import { CircleCheck, MessageCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { Handoff } from "@/lib/contracts";
import { ApiError } from "@/lib/console/api";
import { postJson } from "@/lib/supplier-console/api";
import { withApprover } from "../session/gate";

type Step = { kind: "closed" } | { kind: "open" } | { kind: "busy" } | { kind: "sent"; handoff: Handoff };

/** "Talk to a person at Valio Aimo": the kitchen's question goes to the wholesaler's inbox, with what it will be told back. */
export function AskValio() {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [words, setWords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const root = useRef<HTMLDivElement>(null);

  async function send() {
    setStep({ kind: "busy" });
    setError(null);
    try {
      const handoff = await withApprover(root.current, () => postJson<Handoff>("/api/v1/handoffs", { words: words.trim() }));
      if (!handoff) return setStep({ kind: "open" });
      setWords("");
      setStep({ kind: "sent", handoff });
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 404 ? "Questions to Valio Aimo are not open yet." : "Your question was not sent. Try again.");
      setStep({ kind: "open" });
    }
  }

  if (step.kind === "sent") {
    return (
      <div className="sec-ask-sent" role="status">
        <CircleCheck aria-hidden="true" />
        <p>
          <strong>Sent to Valio Aimo.</strong> {step.handoff.openHours.sentence}
        </p>
      </div>
    );
  }

  if (step.kind === "closed") {
    return (
      <button type="button" className="btn btn-secondary sec-ask-link" onClick={() => setStep({ kind: "open" })}>
        <MessageCircle aria-hidden="true" />
        Talk to a person at Valio Aimo
      </button>
    );
  }

  return (
    <div ref={root}>
      <form
        className="sec-ask"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="field-label" htmlFor={fieldId}>
          What should Valio Aimo know?
        </label>
        <textarea
          id={fieldId}
          className="text-field text-area"
          rows={3}
          maxLength={1000}
          value={words}
          onChange={(event) => setWords(event.target.value)}
          placeholder="For example: an order looks wrong to me."
          autoFocus
        />
        <div className="sec-ask-actions">
          <button type="button" className="btn btn-quiet" onClick={() => setStep({ kind: "closed" })} disabled={step.kind === "busy"}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={step.kind === "busy" || words.trim().length === 0}>
            {step.kind === "busy" ? "Sending…" : "Send"}
          </button>
        </div>
        {error ? (
          <p className="sec-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
