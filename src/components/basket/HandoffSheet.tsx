"use client";

import { Clock3, MessageCircle, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/console/api";
import type { Handoff } from "@/lib/contracts";
import { dayAndTime } from "@/lib/console/format/time";
import { withApprover } from "../session/gate";
import { Sheet } from "../ui/Sheet";
import { closeHandoff, useHandoffTopic, type HandoffTopic } from "./handoff";

const POLL_MS = 3000;
const WORDS_MAX = 500;

/** Reads the hand-off list until a person at Valio Aimo has answered this one. */
function useAnswer(sent: Handoff | null): Handoff | null {
  const [latest, setLatest] = useState<Handoff | null>(null);
  useEffect(() => {
    if (!sent || sent.status === "answered") return;
    let stop = false;
    const timer = setInterval(() => {
      void api
        .handoffs()
        .then((list) => {
          const found = list.find((item) => item.id === sent.id);
          if (!stop && found) setLatest(found);
          if (found?.status === "answered") clearInterval(timer);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [sent]);
  return latest?.id === sent?.id ? latest : sent;
}

function Composer({ topic, onSent }: { topic: HandoffTopic; onSent: (handoff: Handoff) => void }) {
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = words.trim();
    if (!text || busy) return;
    const anchor = event.currentTarget.querySelector("button[type=submit]");
    setBusy(true);
    setError(null);
    try {
      const { basketId, lineId, orderId } = topic;
      const sent = await withApprover(anchor, () => api.askValio({ basketId, lineId, orderId, words: text }));
      if (sent) onSent(sent);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The message was not sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="handoff-form" onSubmit={submit}>
      <p className="handoff-context">{topic.context}</p>
      <label className="field-label" htmlFor="handoff-words">
        Your message
      </label>
      <textarea
        id="handoff-words"
        className="text-field handoff-words"
        rows={4}
        maxLength={WORDS_MAX}
        placeholder="For example: Can you send a nut-free flour instead?"
        value={words}
        onChange={(event) => setWords(event.target.value)}
      />
      {error ? (
        <p className="handoff-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary big" disabled={busy || words.trim() === ""}>
        <Send aria-hidden="true" />
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

function Sent({ handoff }: { handoff: Handoff }) {
  const answered = handoff.status === "answered" && handoff.answer;
  return (
    <div className="handoff-sent" role="status" aria-live="polite">
      <p className="handoff-context">{handoff.context.summary}</p>
      <blockquote className="handoff-bubble" data-from="you">
        {handoff.words}
      </blockquote>
      {answered ? (
        <blockquote className="handoff-bubble" data-from="valio">
          {handoff.answer?.words}
          <span className="handoff-by">
            {handoff.answer?.by}, Valio Aimo · {dayAndTime(handoff.answer?.at ?? handoff.at)}
          </span>
        </blockquote>
      ) : (
        <p className="handoff-wait">
          <Clock3 aria-hidden="true" />
          {handoff.openHours.sentence}
        </p>
      )}
    </div>
  );
}

/** "Ask Valio Aimo": the context filled in, one text field, Send; then when a person answers, and later the answer. */
export function HandoffSheet() {
  const topic = useHandoffTopic();
  const [sent, setSent] = useState<Handoff | null>(null);
  const handoff = useAnswer(sent);

  function close() {
    closeHandoff();
    setSent(null);
  }

  return (
    <Sheet
      open={topic !== null}
      onClose={close}
      kicker={
        <span className="handoff-kicker">
          <MessageCircle aria-hidden="true" />
          A person at Valio Aimo
        </span>
      }
      title={handoff ? "Message sent" : "Ask Valio Aimo"}
      lede={handoff ? undefined : "A person reads it and answers here."}
    >
      {handoff ? <Sent handoff={handoff} /> : topic ? <Composer topic={topic} onSent={setSent} /> : null}
    </Sheet>
  );
}
