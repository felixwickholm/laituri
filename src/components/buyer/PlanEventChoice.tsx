"use client";

import { ArrowUp, Mic, MicOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useVoice } from "../orb/useVoice";

/** The "Plan an event" choice: one field and a mic. The words go to the event assistant. */
export function PlanEventChoice({ onAsk }: { onAsk: (words: string) => void }) {
  const [words, setWords] = useState("");
  const voice = useVoice({ onTranscript: setWords, onRequest: (heard) => onAsk(heard) });

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = words.trim();
    if (text) onAsk(text);
  }

  return (
    <form className="plan-ask" onSubmit={submit}>
      <label htmlFor="plan-q" className="sr-only">
        What kind of event do you have?
      </label>
      <input
        id="plan-q"
        type="text"
        value={words}
        onChange={(event) => setWords(event.target.value)}
        placeholder="What kind of event?"
        autoComplete="off"
        enterKeyHint="go"
      />
      {voice.supported ? (
        <button
          type="button"
          className="icon-btn plan-mic"
          data-listening={voice.listening}
          aria-pressed={voice.listening}
          aria-label={voice.listening ? "Stop listening" : "Say it"}
          onClick={() => (voice.listening ? voice.stop() : voice.start())}
        >
          {voice.listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </button>
      ) : null}
      <button type="submit" className="plan-go" aria-label="Plan it" disabled={!words.trim()}>
        <ArrowUp aria-hidden="true" />
      </button>
    </form>
  );
}
