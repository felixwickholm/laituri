"use client";

import { ArrowUp, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Order } from "@/lib/contracts";
import { engineLine } from "@/lib/console/format/engine";
import { eur } from "@/lib/console/format/money";
import { weekSpend } from "@/lib/console/format/week";
import { orbStateFor } from "@/lib/console/orb-state";
import { spokenRunResult } from "@/lib/console/orb-speech";
import { consoleStore } from "@/lib/console/store";
import type { ConsoleSnapshot, Scenario } from "@/lib/console/types";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";
import { AgentOrb } from "./AgentOrb";
import { TypedCaption } from "./TypedCaption";
import { VOICE_UNSUPPORTED, useVoice } from "./useVoice";

export interface LiveAgentPanelProps {
  snapshot: ConsoleSnapshot;
}

const SUGGESTIONS: { scenario: Scenario; label: string }[] = [
  { scenario: "milk", label: "1,000 l lactose-free milk by Monday" },
  { scenario: "over-limit", label: "1,600 l: over the limit" },
  { scenario: "break-mandate", label: "Try to break the rules" },
];

const ORB_SIZE = 260;

/** "4:32" until the newest waiting offer expires, or undefined when no offer is live. */
function offerCountdown(orders: Order[], nowMs: number): string | undefined {
  const live = orders
    .filter((order) => order.status === "pending_approval")
    .map((order) => Date.parse(order.offer.expiresAt) - nowMs)
    .filter((left) => left > 0)
    .sort((a, b) => a - b)[0];
  if (live === undefined) return undefined;
  const seconds = Math.floor(live / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The agent, live: what it is doing now, and where a person asks it for something by typing or speaking. */
export function LiveAgentPanel({ snapshot }: LiveAgentPanelProps) {
  const now = useNow(500);
  const [request, setRequest] = useState("");
  const [starting, setStarting] = useState<Scenario | "free" | null>(null);
  const spokenRun = useRef<{ id: string; startedAt: number } | null>(null);
  const running = snapshot.run?.status === "running" || starting !== null;

  const start = useCallback(async (body: { scenario?: Scenario; request?: string }, key: Scenario | "free", byVoice = false) => {
    setStarting(key);
    const startedAt = Date.now();
    try {
      const id = await consoleStore.startRun(body);
      spokenRun.current = byVoice ? { id, startedAt } : null;
      if (key === "free") setRequest("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "The agent could not start.", "danger");
    } finally {
      setStarting(null);
    }
  }, []);

  const sendSpoken = useCallback((text: string) => void start({ request: text }, "free", true), [start]);
  const voice = useVoice({ onTranscript: setRequest, onRequest: sendSpoken });

  const { run, orders, mandate } = snapshot;
  useEffect(() => {
    const asked = spokenRun.current;
    if (!run || !asked || run.id !== asked.id || run.status === "running") return;
    spokenRun.current = null;
    void voice.speak(spokenRunResult(run, orders, asked.startedAt, mandate?.mandate));
  }, [run, orders, mandate, voice]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (!text || running) return;
    void start({ request: text }, "free");
  }

  const view = orbStateFor(snapshot, now);
  const state = voice.listening ? "listening" : view.state;
  const caption = voice.listening ? (request ? `Heard: ${request}` : "Listening…") : view.caption;
  const terms = mandate?.mandate;
  const budgetLeft = terms ? terms.limits.perWeek.amount - weekSpend(orders, now) : undefined;
  const countdown = offerCountdown(orders, now);
  const engine = engineLine(snapshot.health);

  return (
    <section className="live-agent" aria-label="Your agent, live" data-ready={snapshot.ready}>
      <p className="live-agent-hint mono">
        <span className="live-dot" data-idle={!snapshot.online} aria-hidden="true" />
        Live · {terms?.agent.name ?? "Harbour purchasing agent"}
      </p>

      <div className="live-agent-stage" data-tour="orb">
        <AgentOrb state={state} digits={view.digits} rulesPassed={view.rulesPassed} rulesTotal={view.rulesTotal} level={voice.level} size={ORB_SIZE} />
        <ul className="orb-chips" aria-label="Mandate at a glance">
          {budgetLeft !== undefined && (
            <li className="orb-chip" data-place="top">
              <span className="orb-chip-key">Left this week</span> {eur(Math.max(0, budgetLeft))}
            </li>
          )}
          {terms && (
            <li className="orb-chip" data-place="side">
              Mandate v{terms.version} <span className="orb-chip-key">signed</span>
            </li>
          )}
          {countdown && (
            <li className="orb-chip" data-place="bottom" data-tone="warn">
              <span className="orb-chip-key">Offer expires in</span> <span className="mono">{countdown}</span>
            </li>
          )}
        </ul>
      </div>

      <TypedCaption text={caption} className="live-agent-caption mono" />

      <form className="composer" onSubmit={submit} data-tour="composer">
        <label className="sr-only" htmlFor="live-agent-ask">
          Ask your agent to buy something
        </label>
        <input
          id="live-agent-ask"
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder={voice.listening ? "Listening…" : running ? `Working on: ${run?.request || "a scene"}` : "Ask your agent to buy something…"}
          disabled={running && !voice.listening}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button
          type="button"
          className="icon-btn composer-mic"
          data-listening={voice.listening}
          disabled={running || !voice.supported}
          onClick={voice.listening ? voice.stop : voice.start}
          aria-label={voice.listening ? "Stop listening" : voice.supported ? "Speak to your agent" : VOICE_UNSUPPORTED}
          title={voice.supported ? undefined : VOICE_UNSUPPORTED}
        >
          {voice.listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </button>
        <button type="submit" className="icon-btn composer-send" disabled={running || request.trim() === ""} aria-label="Send to your agent">
          <ArrowUp aria-hidden="true" />
        </button>
      </form>
      {!voice.supported && <p className="composer-note">{VOICE_UNSUPPORTED}</p>}
      {engine ? (
        <p className="composer-note composer-engine" title={engine.model ? `Typed requests go to ${engine.model}` : "Typed requests are answered by the scripted agent"}>
          {engine.text}
          {engine.model ? <span className="mono"> · {engine.model}</span> : null}
        </p>
      ) : null}

      <div className="suggestions" role="group" aria-label="Try a scene">
        {SUGGESTIONS.map((item) => (
          <button
            key={item.scenario}
            type="button"
            className="suggestion"
            data-tour-scene={item.scenario}
            disabled={running}
            data-running={starting === item.scenario}
            onClick={() => void start({ scenario: item.scenario }, item.scenario)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
