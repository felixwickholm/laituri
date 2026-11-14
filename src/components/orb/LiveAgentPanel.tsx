"use client";

import { ArrowUp, ChevronRight, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Order } from "@/lib/contracts";
import { priceHoldLine } from "@/lib/console/format/approval";
import { shortName } from "@/lib/console/format/rules";
import { orbStateFor } from "@/lib/console/orb-state";
import { spokenRunResult } from "@/lib/console/orb-speech";
import { consoleStore } from "@/lib/console/store";
import { agentSuspension } from "@/lib/console/suspension";
import type { ConsoleSnapshot, Scenario } from "@/lib/console/types";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";
import { AgentOrb } from "./AgentOrb";
import { TypedCaption } from "./TypedCaption";
import { VOICE_UNSUPPORTED, useVoice } from "./useVoice";

export interface LiveAgentPanelProps {
  snapshot: ConsoleSnapshot;
}

interface Scene {
  scenario: Scenario;
  title: string;
  explain: (approver: string) => string;
}

const SCENES: Scene[] = [
  { scenario: "milk", title: "1,000 l lactose-free milk by Monday", explain: () => "Inside the limits, so the agent orders alone." },
  { scenario: "over-limit", title: "1,600 l of the same milk", explain: (approver) => `Over the per-order limit, so it waits for ${approver}.` },
  { scenario: "break-mandate", title: "Try to break the rules", explain: () => "Five attempts the mandate must refuse." },
];

const ORB_SIZE = 88;

/** "Price held until 14:30" when the wholesaler signed a price hold, else "Offer expires in 4:32"; undefined when nothing waits. */
function waitingLine(orders: Order[], nowMs: number): string | undefined {
  const waiting = orders.filter((order) => order.status === "pending_approval");
  const held = waiting.map(priceHoldLine).find(Boolean);
  if (held) return held;
  const live = waiting
    .map((order) => Date.parse(order.offer.expiresAt) - nowMs)
    .filter((left) => left > 0)
    .sort((a, b) => a - b)[0];
  if (live === undefined) return undefined;
  const seconds = Math.floor(live / 1000);
  return `Offer expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The agent, live: one line on what it is doing, a composer to ask it for something, and three scripted scenes. */
export function LiveAgentPanel({ snapshot }: LiveAgentPanelProps) {
  const now = useNow(250);
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
  const suspended = agentSuspension(snapshot.audit, terms?.agent.id) !== undefined;
  const approver = terms ? shortName(terms.approval.approver.name) : "your approver";
  const countdown = waitingLine(orders, now);
  const status = suspended ? "suspended" : snapshot.online ? "live" : "offline";

  return (
    <section className="live-agent" aria-label="Your agent, live" data-ready={snapshot.ready} data-status={status}>
      <div className="live-agent-top">
        <div className="live-agent-stage" data-tour="orb">
          <AgentOrb state={state} digits={view.digits} rulesPassed={view.rulesPassed} rulesTotal={view.rulesTotal} level={voice.level} size={ORB_SIZE} />
        </div>
        <div className="live-agent-say">
          <p className="live-agent-name">
            <span>{terms?.agent.name ?? "Your purchasing agent"}</span>
            <span className="live-status" data-status={status}>
              <span className="live-dot" aria-hidden="true" />
              {status === "suspended" ? "Suspended" : status === "live" ? "Live" : "Offline"}
            </span>
          </p>
          <TypedCaption text={caption} className="live-agent-caption" />
          {countdown && !suspended ? (
            <p className="live-agent-offer num">{countdown}</p>
          ) : null}
        </div>
      </div>

      <form className="composer" onSubmit={submit} data-tour="composer">
        <label className="sr-only" htmlFor="live-agent-ask">
          Ask your agent to buy something
        </label>
        <input
          id="live-agent-ask"
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder={voice.listening ? "Listening…" : running ? `Working on: ${run?.request || "a scene"}` : "Ask your agent to buy something"}
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

      <div className="scenes" role="group" aria-labelledby="scenes-note">
        <p className="scenes-note" id="scenes-note">
          Demo scenes are scripted
        </p>
        {SCENES.map((scene) => (
          <button
            key={scene.scenario}
            type="button"
            className="scene"
            data-tour-scene={scene.scenario}
            disabled={running}
            data-running={starting === scene.scenario || (snapshot.run?.status === "running" && snapshot.run.scenario === scene.scenario)}
            onClick={() => void start({ scenario: scene.scenario }, scene.scenario)}
          >
            <span className="scene-title">{scene.title}</span>
            <span className="scene-explain">{scene.explain(approver)}</span>
            <ChevronRight className="scene-go" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
