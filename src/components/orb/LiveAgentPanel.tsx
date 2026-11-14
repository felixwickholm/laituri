"use client";

import { ArrowUp, CalendarDays, Milk, Mic, ShoppingBasket, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Basket, Order } from "@/lib/contracts";
import { isEventRequest, isWeeklyRequest } from "@/lib/console/basket";
import { priceHoldLine } from "@/lib/console/format/approval";
import { orbStateFor } from "@/lib/console/orb-state";
import { spokenRunResult } from "@/lib/console/orb-speech";
import { consoleStore } from "@/lib/console/store";
import { agentSuspension } from "@/lib/console/suspension";
import type { ConsoleSnapshot } from "@/lib/console/types";
import { startWeeklyOrder } from "../basket/start";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";
import { AgentOrb } from "./AgentOrb";
import { TypedCaption } from "./TypedCaption";
import { VOICE_UNSUPPORTED, useVoice } from "./useVoice";

export interface LiveAgentPanelProps {
  snapshot: ConsoleSnapshot;
  baskets: Basket[];
}

/** Valio Aimo's own example, word for word: one tap away. */
export const MILK_REQUEST = "I need 1,000 litres of lactose-free milk by Monday.";
const DINNER_REQUEST = "Plan a dinner for 80 on Friday";

const ORB_SIZE = 200;

/** "Price held until 14:30" when the wholesaler signed a price hold, else "Price fixed for 4:32"; undefined when nothing waits. */
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
  return `Price fixed for ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} more`;
}

/** The plan page with the person's words, for a sentence about an event or guests. */
function planHref(words: string): string {
  return `/buyer/plan?words=${encodeURIComponent(words)}`;
}

/** The agent, live: a large orb, one line on what it does, and the order field with three examples. */
export function LiveAgentPanel({ snapshot, baskets }: LiveAgentPanelProps) {
  const router = useRouter();
  const now = useNow(250);
  const [request, setRequest] = useState("");
  const [starting, setStarting] = useState(false);
  const spokenRun = useRef<{ id: string; startedAt: number } | null>(null);
  const basketRunning = baskets.some((basket) => basket.status === "running");
  const running = snapshot.run?.status === "running" || starting || basketRunning;

  /** One sentence in: an event goes to the planner, the weekly order starts the basket, anything else is one request. */
  const send = useCallback(
    async (text: string, byVoice = false) => {
      if (isEventRequest(text)) {
        router.push(planHref(text));
        return;
      }
      setStarting(true);
      const startedAt = Date.now();
      try {
        if (isWeeklyRequest(text)) {
          await startWeeklyOrder();
        } else {
          const id = await consoleStore.startRun({ request: text });
          spokenRun.current = byVoice ? { id, startedAt } : null;
        }
        setRequest("");
      } catch (error) {
        toast(error instanceof Error ? error.message : "Your agent could not start.", "danger");
      } finally {
        setStarting(false);
      }
    },
    [router],
  );

  const sendSpoken = useCallback((text: string) => void send(text, true), [send]);
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
    void send(text);
  }

  const view = orbStateFor(snapshot, now, baskets);
  const state = voice.listening ? "listening" : view.state;
  const caption = voice.listening ? (request ? `Heard: ${request}` : "Listening…") : view.caption;
  const terms = mandate?.mandate;
  const suspended = agentSuspension(snapshot.audit, terms?.agent.id) !== undefined;
  const countdown = waitingLine(orders, now);
  const status = suspended ? "suspended" : snapshot.online ? "live" : "offline";

  return (
    <section className="live-agent" aria-label="Your agent, live" data-ready={snapshot.ready} data-status={status}>
      <div className="live-agent-stage" data-tour="orb">
        <AgentOrb state={state} digits={view.digits} rulesPassed={view.rulesPassed} rulesTotal={view.rulesTotal} level={voice.level} size={ORB_SIZE} />
      </div>
      <div className="live-agent-say">
        <p className="live-agent-name">
          <span>Your agent</span>
          <span className="live-status" data-status={status}>
            <span className="live-dot" aria-hidden="true" />
            {status === "suspended" ? "Stopped by Valio Aimo" : status === "live" ? "Live" : "Offline"}
          </span>
        </p>
        <TypedCaption text={caption} className="live-agent-caption" />
        {countdown && !suspended ? <p className="live-agent-offer num">{countdown}</p> : null}
      </div>

      <form className="composer" onSubmit={submit} data-tour="composer">
        <label className="composer-label" htmlFor="live-agent-ask">
          Tell your agent what you need
        </label>
        <div className="composer-field">
          <input
            id="live-agent-ask"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder={voice.listening ? "Listening…" : running ? "Your agent is working…" : "Product, amount and day"}
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
            aria-label={voice.listening ? "Stop listening" : voice.supported ? "Say it instead" : VOICE_UNSUPPORTED}
            title={voice.supported ? undefined : VOICE_UNSUPPORTED}
          >
            {voice.listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
          </button>
          <button type="submit" className="icon-btn composer-send" disabled={running || request.trim() === ""} aria-label="Order it">
            <ArrowUp aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="examples" role="group" aria-label="Examples">
        <button type="button" className="example" data-tour-scene="milk" disabled={running} onClick={() => void send(MILK_REQUEST)}>
          <Milk aria-hidden="true" />
          {MILK_REQUEST}
        </button>
        <Link className="example" href={planHref(DINNER_REQUEST)}>
          <CalendarDays aria-hidden="true" />
          {DINNER_REQUEST}
        </Link>
        <button type="button" className="example" disabled={running} onClick={() => void send("Order this week's lines")}>
          <ShoppingBasket aria-hidden="true" />
          Order this week’s lines
        </button>
      </div>
    </section>
  );
}
