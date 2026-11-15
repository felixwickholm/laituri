"use client";

import { ArrowUp, ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { flowSteps } from "@/lib/console/format/flow";
import { buildRuns } from "@/lib/console/runs";
import { consoleStore, useConsole } from "@/lib/console/store";
import { FlowSteps } from "../order/FlowSteps";
import { useUi } from "../shell/ui-context";
import { toast } from "../ui/toast";
import { approvalInWords } from "./MilkExample";

/** Words that read as a request to the agent rather than a product search: three words or more, or a number. */
export function looksLikeRequest(words: string): boolean {
  const text = words.trim();
  return text.split(/\s+/).length >= 3 || (/\d/.test(text) && /\p{L}{2,}/u.test(text));
}

/** The first request of a conversation, without earlier answers stacked on it. */
function originalOf(words: string): string {
  const at = words.indexOf("\nEarlier: ");
  return at >= 0 ? words.slice(at + "\nEarlier: ".length) : words;
}

/** What the buyer said last: the answer, when the words carry an earlier request. */
function shownWords(words: string): string {
  const at = words.indexOf("\nEarlier: ");
  return at >= 0 ? words.slice(0, at) : words;
}

interface RunResult {
  status?: string;
  orderId?: string;
  steps?: { text: string; status: string }[];
}

/**
 * A sentence in the buyer's own words, sent to the buyer's agent (Gemini, then Claude, then the scripted agent).
 * The agent asks back when the product or amount is unclear; the answer goes back with the first words.
 */
export function AgentAsk({ query, onSent }: { query: string; onSent: () => void }) {
  const snapshot = useConsole();
  const ui = useUi();
  const [runId, setRunId] = useState<string>();
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [starting, setStarting] = useState(false);
  const run = snapshot.run && snapshot.run.id === runId ? snapshot.run : undefined;
  const result = (run?.results as RunResult[] | undefined)?.[0];
  const orderId = result?.orderId;
  const order = orderId ? snapshot.orders.find((item) => item.id === orderId) : undefined;
  const working = starting || run?.status === "running";
  const startedAt = (run as { startedAt?: string } | undefined)?.startedAt;
  const live = useMemo(
    () =>
      working && startedAt
        ? snapshot.activity.filter((item) => item.kind === "note" && item.at >= startedAt).map((item) => item.title).at(-1)
        : undefined,
    [working, startedAt, snapshot.activity],
  );
  const stepTexts = useMemo(
    () => (orderId ? (buildRuns(snapshot.activity, snapshot.orders).find((item) => item.orderIds.includes(orderId))?.steps.map((step) => step.text) ?? []) : []),
    [snapshot.activity, snapshot.orders, orderId],
  );

  async function send(words: string) {
    setStarting(true);
    try {
      setRunId(await consoleStore.startRun({ request: words.slice(0, 300) }));
      setAsked(words);
      setAnswer("");
      onSent();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Your agent could not start.", "danger");
    } finally {
      setStarting(false);
    }
  }

  function reply(event: FormEvent) {
    event.preventDefault();
    const text = answer.trim();
    if (!text || working) return;
    // The answer first, then the request it answers: the agent reads the answer and fills gaps from the request.
    void send(`${text}\nEarlier: ${originalOf(asked)}`);
  }

  const showChip = looksLikeRequest(query) && !working;
  const question = run?.status === "done" && !orderId && result?.status === "needs_input" ? run.summary : undefined;
  const steps = order ? flowSteps(order, stepTexts) : undefined;

  return (
    <div className="milk-example agent-ask">
      {showChip ? (
        <button type="button" className="milk-chip" onClick={() => void send(query.trim())}>
          <Sparkles aria-hidden="true" />
          <span>Ask your agent: “{query.trim()}”</span>
        </button>
      ) : null}
      {working ? (
        <p className="agent-ask-live" aria-live="polite">
          <Sparkles aria-hidden="true" />
          {live ?? "Your agent is reading your words…"}
        </p>
      ) : steps && order ? (
        <div className="milk-result" aria-live="polite">
          <p className="agent-ask-words">“{shownWords(asked)}”</p>
          <FlowSteps steps={steps.map((step) => (step.name === "Approval" ? approvalInWords(order, step) : step))} />
          <button type="button" className="text-link milk-open" onClick={() => ui.openOrder(order.id)}>
            Open the order
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : question ? (
        <form className="milk-result agent-ask-question" onSubmit={reply} aria-live="polite">
          <p className="agent-ask-words">“{shownWords(asked)}”</p>
          <p className="agent-ask-reply">{question}</p>
          <div className="agent-ask-field">
            <label htmlFor="agent-ask-answer" className="sr-only">
              Your answer
            </label>
            <input id="agent-ask-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Your answer" autoComplete="off" maxLength={200} />
            <button type="submit" className="icon-btn" aria-label="Send your answer" disabled={!answer.trim()}>
              <ArrowUp aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : run && run.status !== "running" ? (
        <div className="milk-result" aria-live="polite">
          <p className="agent-ask-words">“{shownWords(asked)}”</p>
          <p className="milk-failed">{run.summary ?? "No order was placed."}</p>
        </div>
      ) : null}
    </div>
  );
}
