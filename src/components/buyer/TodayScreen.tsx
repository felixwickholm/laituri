"use client";

import { CalendarHeart, MessageCircle, ShoppingBasket, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isEventRequest } from "@/lib/console/basket";
import { weeklyBasket, isoWeek } from "@/lib/console/basket-verdict";
import { useBaskets } from "@/lib/console/basket-store";
import { longDay } from "@/lib/console/format/time";
import { LOCKED_NOTE } from "@/lib/console/paused";
import { useConsole } from "@/lib/console/store";
import { agentSuspension } from "@/lib/console/suspension";
import { EventAssistant } from "../assistant/EventAssistant";
import { GENERAL_TOPIC, askValioAimo } from "../basket/handoff";
import { useWeeklyDraft } from "../basket/useWeeklyDraft";
import { WeeklyDraftCard } from "../basket/WeeklyDraftCard";
import { WeeklyVerdict } from "../basket/WeeklyVerdict";
import { QuickCatalogue, QuickSearch } from "../shop/QuickOrder";
import { useNow } from "../ui/useNow";
import { AgentAsk, looksLikeRequest } from "./AgentAsk";
import { MilkExample } from "./MilkExample";
import { PlanEventChoice } from "./PlanEventChoice";
import { SuspensionBanner } from "./SuspensionBanner";
import { TodayIdeas } from "./TodayIdeas";
import "./today.css";

/** Today: two big choices (order directly, plan an event), this week's order as one verdict, a few ideas, a person. */
export function TodayScreen({ basketId }: { basketId?: string }) {
  const snapshot = useConsole();
  const { baskets, ready: basketsReady } = useBaskets();
  const router = useRouter();
  const now = useNow(60_000);
  const [query, setQuery] = useState("");
  /** The event words handed to the assistant; a new key starts a new conversation. */
  const [event, setEvent] = useState<{ words: string; key: number }>();
  const hero = baskets.find((basket) => basket.id === basketId) ?? weeklyBasket(baskets, now);
  const draft = useWeeklyDraft(basketsReady && !hero);
  const agent = snapshot.mandate?.mandate.agent;
  const suspension = agentSuspension(snapshot.audit, agent?.id);

  /** Enter on a sentence: an event goes to the planner, anything else to the agent through the chip below the field. */
  function submitWords(words: string) {
    if (!looksLikeRequest(words)) return;
    if (isEventRequest(words)) {
      planEvent(words);
      setQuery("");
      return;
    }
    document.querySelector<HTMLButtonElement>(".agent-ask .milk-chip")?.click();
  }

  function planEvent(words: string) {
    setEvent((current) => ({ words, key: (current?.key ?? 0) + 1 }));
  }

  return (
    <div className="page today-page">
      <header className="page-head">
        <div>
          <h1>Today</h1>
          <p className="page-date" suppressHydrationWarning>
            {longDay(now)} · week {isoWeek(now)}
          </p>
        </div>
      </header>
      {snapshot.locked ? <p className="today-locked">{LOCKED_NOTE}</p> : null}
      {suspension ? <SuspensionBanner suspension={suspension} agent={agent?.name ?? "your agent"} /> : null}

      <div className="today-choices">
        <section className="glass today-choice" data-choice="order" aria-labelledby="choice-order">
          <h2 id="choice-order" className="today-choice-title">
            <ShoppingBasket aria-hidden="true" />
            Order directly
          </h2>
          <QuickSearch value={query} onChange={setQuery} onEnter={submitWords} placeholder="Milk, butter… or say it in your own words" />
          <AgentAsk query={query} onSent={() => setQuery("")} />
          <MilkExample />
        </section>
        <QuickCatalogue query={query} />
        <section className="glass today-choice" data-choice="plan" aria-labelledby="choice-plan">
          <h2 id="choice-plan" className="today-choice-title">
            <CalendarHeart aria-hidden="true" />
            Plan an event
          </h2>
          <PlanEventChoice onAsk={planEvent} />
        </section>
        {event ? (
          <section className="today-assistant" aria-label="Event assistant">
            <button type="button" className="icon-btn today-assistant-close" aria-label="Close the event plan" onClick={() => setEvent(undefined)}>
              <X aria-hidden="true" />
            </button>
            <EventAssistant
              key={event.key}
              initialWords={event.words}
              mode="compact"
              onOrdered={(basket) => {
                setEvent(undefined);
                router.push(`/buyer?basket=${encodeURIComponent(basket.basketId)}`);
              }}
            />
          </section>
        ) : null}
      </div>

      {hero ? <WeeklyVerdict basket={hero} /> : basketsReady ? <WeeklyDraftCard state={draft} /> : <section className="glass pad weekly-verdict" aria-busy="true" />}

      <TodayIdeas skip={(suggestion) => suggestion.kind === "weekly_due"} />

      <button type="button" className="text-link today-person" onClick={() => askValioAimo(GENERAL_TOPIC)}>
        <MessageCircle aria-hidden="true" />
        Talk to a person at Valio Aimo
      </button>
    </div>
  );
}
