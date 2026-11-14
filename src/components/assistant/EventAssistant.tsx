"use client";

import { ArrowUp, Mic, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AssistantAction, AssistantMenuCard, AssistantTurn, Recipe } from "@/lib/contracts";
import type { VoiceLanguage } from "@/lib/voice";
import { BasketCard } from "../basket/BasketCard";
import { assistantApi } from "./api";
import { MenuOptionCard, RecipeOpen, RecipeTile, ShoppingCard } from "./AssistantCards";
import { useVoiceConversation, type VoiceState } from "./useVoiceConversation";

export interface EventAssistantProps {
  /** Words to start with, for example from a suggestion: sent once on mount. */
  initialWords?: string;
  /** compact: menus as short cards, no recipes or shopping list. expanded: everything. */
  mode?: "compact" | "expanded";
  /** The question at the top. */
  title?: string;
  /** Called when a menu was ordered: the basket is running. */
  onOrdered?(basket: { basketId: string; title: string }): void;
}

const STATE_WORD: Record<Exclude<VoiceState, "off">, { fi: string; en: string }> = {
  listening: { fi: "Kuuntelen", en: "Listening" },
  thinking: { fi: "Mietin", en: "Thinking" },
  speaking: { fi: "Puhun", en: "Speaking" },
};

const PLACEHOLDER = { fi: "Häät lauantaina, 80 vierasta, kaksi keliaakikkoa", en: "Wedding on Saturday, 80 guests, two coeliacs" };
const WELCOME = { fi: "Kerro tapahtumasta, niin teen menun ja tilauksen.", en: "Tell me about the event. I'll make the menu and the order." };

function browserLanguage(): "fi" | "en" {
  return navigator.language?.toLowerCase().startsWith("fi") ? "fi" : "en";
}
const noSubscription = () => () => undefined;

/**
 * The event assistant: the kitchen says or types what is coming, the assistant asks only what it needs, and the
 * answer is cards (menus with a price per guest, recipes, the shopping list) and one tap to order. The conversation
 * stays short on screen: the last few turns only.
 */
export function EventAssistant({ initialWords, mode = "expanded", title = "What kind of event do you have?", onOrdered }: EventAssistantProps) {
  const compact = mode === "compact";
  const [turn, setTurn] = useState<AssistantTurn>();
  const [picked, setLanguage] = useState<"fi" | "en">();
  const fromBrowser = useSyncExternalStore(noSubscription, browserLanguage, () => "en" as const);
  const language = picked ?? fromBrowser;
  const [words, setWords] = useState("");
  const [sending, setSending] = useState<string>();
  const [error, setError] = useState<string>();
  const [orderingId, setOrderingId] = useState<string>();
  const [ordered, setOrdered] = useState<{ basketId: string; title: string }>();
  const [recipe, setRecipe] = useState<Recipe>();
  const conversationId = useRef<string | undefined>(undefined);
  const started = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const placeOrder = useCallback(
    async (action: Extract<AssistantAction, { kind: "order_menu" }>) => {
      setOrderingId(action.menuId);
      setError(undefined);
      try {
        const { basketId } = await assistantApi.placeBasket(action.basket);
        const done = { basketId, title: action.basket.title ?? "Event" };
        setOrdered(done);
        onOrdered?.(done);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The order did not start. Try again.");
      } finally {
        setOrderingId(undefined);
      }
    },
    [onOrdered],
  );

  /** Sends one turn; resolves with the reply, for the voice to speak. */
  const send = useCallback(
    async (text: string, menuId?: string): Promise<string | undefined> => {
      const said = text.trim();
      if (!said) return undefined;
      setSending(said);
      setError(undefined);
      try {
        const next = await assistantApi.turn({ conversationId: conversationId.current, words: said, ...(menuId ? { menuId } : {}) });
        conversationId.current = next.conversationId;
        setTurn(next);
        setLanguage(next.language);
        setWords("");
        if (!next.cards.some((card) => card.kind === "menu")) setOrdered(undefined);
        const now = next.actions.find((action): action is Extract<AssistantAction, { kind: "order_menu" }> => action.kind === "order_menu" && Boolean(action.now));
        if (now) void placeOrder(now);
        return next.reply;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No answer. Try again.");
        return undefined;
      } finally {
        setSending(undefined);
      }
    },
    [placeOrder],
  );

  useEffect(() => {
    if (started.current || !initialWords?.trim()) return;
    started.current = true;
    void send(initialWords);
  }, [initialWords, send]);

  const voiceLanguage: VoiceLanguage = language === "fi" ? "fi-FI" : "en-US";
  const voice = useVoiceConversation({ language: voiceLanguage, onHeard: (heard) => send(heard) });

  async function openRecipe(id: string): Promise<void> {
    try {
      setRecipe(await assistantApi.recipe(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The recipe did not open.");
    }
  }

  const menus = (turn?.cards ?? []).filter((card): card is AssistantMenuCard => card.kind === "menu");
  const focusId = (menus.find((menu) => menu.chosen) ?? menus.find((menu) => menu.recommended) ?? menus[0])?.id;
  const shopping = turn?.cards.find((card) => card.kind === "shopping");
  const recipes = (turn?.cards ?? []).filter((card) => card.kind === "recipe");
  const quick = (turn?.actions ?? []).filter((action) => action.kind === "reply");
  const orderFor = (menuId: string) =>
    turn?.actions.find((action): action is Extract<AssistantAction, { kind: "order_menu" }> => action.kind === "order_menu" && action.menuId === menuId);
  const earlier = (turn?.turns ?? []).slice(0, -1).slice(compact ? -1 : -3);
  const busy = Boolean(sending) || voice.state === "thinking";
  const stateWord = voice.state !== "off" ? STATE_WORD[voice.state][language] : sending ? STATE_WORD.thinking[language] : undefined;
  const guests = menus[0]?.guests;

  return (
    <section className="assistant" data-mode={mode} data-voice={voice.state} aria-label="Plan an event">
      <div className="as-head">
        <h2 className="as-title">{title}</h2>
        <div className="as-lang" role="group" aria-label="Language">
          {(["fi", "en"] as const).map((code) => (
            <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {earlier.length ? (
        <ol className="as-turns" aria-label="Earlier in the conversation">
          {earlier.map((line, at) => (
            <li key={`${at}-${line.words}`} data-from={line.from}>
              {line.words}
            </li>
          ))}
        </ol>
      ) : null}

      <p className="as-reply" aria-live="polite">
        {sending ? <span className="as-heard">{sending}</span> : turn?.reply ?? WELCOME[language]}
      </p>

      <form
        className="as-ask"
        onSubmit={(event) => {
          event.preventDefault();
          void send(words);
        }}
      >
        <input
          ref={input}
          className="as-input"
          value={voice.state === "listening" && voice.interim ? voice.interim : words}
          onChange={(event) => setWords(event.target.value)}
          placeholder={PLACEHOLDER[language]}
          aria-label="Your event in your own words"
          enterKeyHint="send"
          maxLength={500}
          disabled={voice.state !== "off"}
        />
        <button
          type="button"
          className="as-mic"
          data-state={voice.state}
          onClick={voice.tap}
          aria-label={voice.state === "off" ? "Talk" : voice.state === "speaking" ? "Interrupt and talk" : "Stop talking"}
          aria-pressed={voice.state !== "off"}
        >
          {voice.state === "off" ? <Mic aria-hidden /> : voice.state === "speaking" ? <Volume2 aria-hidden /> : <Square aria-hidden />}
        </button>
        <button type="submit" className="as-send" disabled={busy || !words.trim() || voice.state !== "off"} aria-label="Send">
          <ArrowUp aria-hidden />
        </button>
      </form>

      <p className="as-state" role="status" data-on={Boolean(stateWord)}>
        {stateWord ? (
          <>
            <span className="as-state-dot" aria-hidden />
            {stateWord}
            {voice.state !== "off" ? <span className="as-state-hint">{language === "fi" ? " · napauta lopettaaksesi" : " · tap to stop"}</span> : null}
          </>
        ) : (
          voice.problem ?? error ?? ""
        )}
      </p>

      {quick.length && !busy ? (
        <div className="as-chips" aria-label="Quick answers">
          {quick.map((action) =>
            action.kind === "reply" ? (
              <button key={action.label} type="button" className="as-chip" onClick={() => void send(action.words)}>
                {action.label}
              </button>
            ) : null,
          )}
        </div>
      ) : null}

      {ordered ? (
        <div className="as-ordered">
          <h3 className="as-ordered-title">{language === "fi" ? "Tilaus käynnissä" : "Ordering"}: {ordered.title}</h3>
          <BasketCard basketId={ordered.basketId} />
        </div>
      ) : null}

      {menus.length && !ordered ? (
        <div className="as-menus" data-busy={busy}>
          {menus.map((menu) => {
            const order = orderFor(menu.id);
            return (
              <MenuOptionCard
                key={menu.id}
                menu={menu}
                focus={menu.id === focusId}
                compact={compact}
                ordering={orderingId === menu.id}
                disabled={busy || Boolean(orderingId)}
                onChoose={() => void send(menu.label, menu.id)}
                onOrder={() => (order ? void placeOrder(order) : undefined)}
                onRecipe={(id) => void openRecipe(id)}
              />
            );
          })}
        </div>
      ) : null}

      {recipe ? <RecipeOpen key={recipe.id} recipe={recipe} portions={guests} onClose={() => setRecipe(undefined)} /> : null}

      {!compact && recipes.length ? (
        <div className="as-recipes">
          {recipes.map((card) => (card.kind === "recipe" ? <RecipeTile key={card.id} recipe={card} onOpen={() => void openRecipe(card.id)} /> : null))}
        </div>
      ) : null}

      {!compact && shopping && shopping.kind === "shopping" && !ordered ? <ShoppingCard list={shopping} /> : null}
    </section>
  );
}
