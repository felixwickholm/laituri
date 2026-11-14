"use client";

import { ArrowRight, CalendarClock, ChefHat, Leaf, PackageOpen, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import { ideaText } from "@/lib/console/basket-verdict";
import { menuApi } from "@/lib/menu-console/api";
import { addDays, isoDay, suggestionAction, type SuggestionAction } from "@/lib/menu-console/format";
import { useSuggestions } from "@/lib/menu-console/hooks";
import type { Suggestion } from "@/lib/menu-console/types";
import { toast } from "../ui/toast";

const ICON: Record<string, ComponentType<{ "aria-hidden"?: boolean }>> = {
  weekly_due: CalendarClock,
  event: ChefHat,
  drift: TrendingUp,
  low_pantry: PackageOpen,
  seasonal: Leaf,
};

const MAX = 3;


/** Up to three things the agent proposes, one line each with one action. Nothing shows while there are none. */
export function TodayIdeas({ skip }: { skip?: (suggestion: Suggestion) => boolean }) {
  const { data } = useSuggestions();
  const shown = (data ?? []).filter((suggestion) => !skip?.(suggestion)).slice(0, MAX);
  if (shown.length === 0) return null;
  return (
    <section className="ideas" aria-labelledby="ideas-title">
      <h2 id="ideas-title" className="section-title">
        Ideas for you
      </h2>
      <p className="ideas-lede">Based on your orders, the season and your next event.</p>
      <ul className="ideas-row">
        {shown.map((suggestion) => (
          <Idea key={suggestion.id} suggestion={suggestion} />
        ))}
      </ul>
    </section>
  );
}

function Idea({ suggestion }: { suggestion: Suggestion }) {
  const Icon = ICON[suggestion.kind] ?? Leaf;
  const action = suggestionAction(suggestion);
  return (
    <li className="glass idea" data-kind={suggestion.kind}>
      <Icon aria-hidden />
      <p className="idea-text" title={suggestion.sentence}>
        {ideaText(suggestion)}
      </p>
      {action ? <IdeaAction action={action} /> : null}
    </li>
  );
}

function IdeaAction({ action }: { action: SuggestionAction }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (action.kind === "link" && action.href.startsWith("http")) {
    return (
      <a className="idea-action" href={action.href} target="_blank" rel="noreferrer">
        {action.label}
        <ArrowRight aria-hidden="true" />
      </a>
    );
  }
  if (action.kind === "link") {
    return (
      <Link className="idea-action" href={action.href}>
        {action.label}
        <ArrowRight aria-hidden="true" />
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
    <button type="button" className="idea-action" onClick={() => void run()} disabled={busy}>
      {busy ? "Starting…" : action.label}
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
