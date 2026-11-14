"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/console/api";
import type { WeeklyDraft } from "@/lib/contracts";

export type DraftState = { status: "loading" } | { status: "ready"; draft: WeeklyDraft } | { status: "missing" };

/** This week's standing order as the agent proposes it. Read once while no weekly basket exists this week. */
export function useWeeklyDraft(enabled: boolean): DraftState {
  const [state, setState] = useState<DraftState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void api
      .weeklyDraft()
      .then((draft) => !cancelled && setState({ status: "ready", draft }))
      .catch(() => !cancelled && setState({ status: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return state;
}
