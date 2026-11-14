"use client";

import { ArrowUp, Mic, MicOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useVoice } from "../orb/useVoice";
import { VoiceSoon } from "../ui/VoiceSoon";

/** Three ways a kitchen might say it, in English and Finnish, the languages the assistant reads. */
const EXAMPLES = [
  "A wedding for 80 guests on Saturday",
  "Pikkujoulut 40 hengelle perjantaina, gluteeniton",
  "Christmas lunch for 30 on Friday, vegetarian",
];

/** The "Plan an event" choice: one field, a mic and three examples. The words go to the event assistant. */
export function PlanEventChoice({ onAsk }: { onAsk: (words: string) => void }) {
  const [words, setWords] = useState("");
  const voice = useVoice({
    onTranscript: setWords,
    onRequest: (heard) => onAsk(heard),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = words.trim();
    if (text) onAsk(text);
  }

  return (
    <>
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
            {voice.listening ? (
              <MicOff aria-hidden="true" />
            ) : (
              <Mic aria-hidden="true" />
            )}
          </button>
        ) : (
          <VoiceSoon className="icon-btn plan-mic" />
        )}
        <button
          type="submit"
          className="plan-go"
          aria-label="Plan it"
          disabled={!words.trim()}
        >
          <ArrowUp aria-hidden="true" />
        </button>
      </form>
      <div className="plan-examples" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="plan-example"
            onClick={() => onAsk(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </>
  );
}
