"use client";

import { ArrowRight, CalendarClock, ChefHat, Leaf, PackageOpen, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import { menuApi } from "@/lib/menu-console/api";
import { addDays, isoDay, suggestionAction, type SuggestionAction } from "@/lib/menu-console/format";
import { useSuggestions } from "@/lib/menu-console/hooks";
import type { Suggestion, SuggestionKind } from "@/lib/menu-console/types";
import { toast } from "../ui/toast";

const ICON: Record<SuggestionKind, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  weekly_due: CalendarClock,
  event: ChefHat,
  drift: TrendingUp,
  low_pantry: PackageOpen,
  seasonal: Leaf,
};

const MAX = 3;

/** What the agent proposes before anyone asks: at most three calm cards with one action each. */
export function Suggestions() {
  const { data } = useSuggestions();
  const shown = (data ?? []).slice(0, MAX);
  if (shown.length === 0) return null;
  return (
    <section className="suggest" aria-label="Your agent suggests">
      <ul className="suggest-row">
        {shown.map((suggestion) => (
          <SuggestionCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </ul>
    </section>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const Icon = ICON[suggestion.kind] ?? CalendarClock;
  const action = suggestionAction(suggestion);
  const seasonal = suggestion.kind === "seasonal";
  return (
    <li className="suggest-card" data-kind={suggestion.kind}>
      <span className="suggest-icon">
        <Icon size={20} aria-hidden />
      </span>
      {seasonal ? <span className="suggest-from">Idea from Valio Aimo</span> : null}
      <h3 className="suggest-head">{suggestion.headline}</h3>
      <p className="suggest-text">{suggestion.sentence}</p>
      {action ? <SuggestionButton action={action} /> : null}
    </li>
  );
}

function SuggestionButton({ action }: { action: SuggestionAction }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (action.kind === "link" && action.href.startsWith("http")) {
    return (
      <a className="suggest-action" href={action.href} target="_blank" rel="noreferrer">
        {action.label}
        <ArrowRight size={18} aria-hidden />
      </a>
    );
  }
  if (action.kind === "link") {
    return (
      <Link className="suggest-action" href={action.href}>
        {action.label}
        <ArrowRight size={18} aria-hidden />
      </Link>
    );
  }

  const line = action.kind === "ask" ? action.line : undefined;

  async function run(): Promise<void> {
    setBusy(true);
    try {
      const { basketId } =
        line === undefined
          ? await menuApi.startWeekly()
          : await menuApi.placeBasket({ title: line.words, deliverBy: addDays(isoDay(Date.now()), 1), source: "manual", lines: [line] });
      router.push(`/buyer?basket=${encodeURIComponent(basketId)}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "That did not start. Try again.", "danger");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="suggest-action"
      onClick={run}
      disabled={busy}
    >
      {busy ? "Starting…" : action.label}
      <ArrowRight size={18} aria-hidden />
    </button>
  );
}
