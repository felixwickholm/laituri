"use client";

import { ArrowRight, Mic, Square } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useVoice } from "@/components/orb/useVoice";
import type { PlanDetails, PlanRequest } from "@/lib/menu-console/types";
import { DetailsForm } from "./DetailsForm";

const STARTERS = ["Wedding dinner for 80", "Lunch for 120 tomorrow", "School lunch for 150, no nuts or sesame"];

interface AskEventProps {
  /** What the field holds when the screen opens again through "Edit". */
  initial?: PlanRequest;
  onPlan: (request: PlanRequest) => void;
}

/** One question, one field, three taps. The details form waits behind a quiet link. */
export function AskEvent({ initial, onPlan }: AskEventProps) {
  const [words, setWords] = useState(initial && "words" in initial ? initial.words : "");
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initial && !("words" in initial)));
  const voice = useVoice({ onTranscript: setWords, onRequest: (text) => onPlan({ words: text }) });

  function submit(event: FormEvent): void {
    event.preventDefault();
    const text = words.trim();
    if (text) onPlan({ words: text });
  }

  return (
    <section className="glass pad verdict ask" aria-labelledby="ask-title">
      <h2 id="ask-title" className="verdict-title ask-title">
        What kind of event do you have?
      </h2>
      <form className="ask-form" onSubmit={submit} data-tour="plan-event">
        <label htmlFor="ask-words" className="sr-only">
          Your event in one sentence
        </label>
        <input
          id="ask-words"
          className="ask-field"
          value={words}
          onChange={(event) => setWords(event.target.value)}
          placeholder="Wedding dinner for 80 on Saturday, no nuts"
          autoComplete="off"
          enterKeyHint="go"
        />
        {voice.supported ? (
          <button
            type="button"
            className="ask-mic"
            data-listening={voice.listening}
            onClick={voice.listening ? voice.stop : voice.start}
            aria-label={voice.listening ? "Stop listening" : "Say it"}
            aria-pressed={voice.listening}
          >
            {voice.listening ? <Square size={18} aria-hidden /> : <Mic size={22} aria-hidden />}
          </button>
        ) : null}
        <button type="submit" className="ask-go" disabled={!words.trim()} aria-label="Plan it">
          <ArrowRight size={22} aria-hidden />
        </button>
      </form>
      {voice.listening ? (
        <p className="ask-listening" role="status">
          Listening…
        </p>
      ) : null}
      <ul className="ask-starters" aria-label="Or tap one">
        {STARTERS.map((starter) => (
          <li key={starter}>
            <button type="button" className="ask-chip" onClick={() => onPlan({ words: starter })}>
              {starter}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ask-details-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
        {detailsOpen ? "Hide details" : "Details"}
      </button>
      {detailsOpen ? (
        <DetailsForm initial={initial && !("words" in initial) ? (initial as PlanDetails) : undefined} onPlan={onPlan} />
      ) : null}
    </section>
  );
}
