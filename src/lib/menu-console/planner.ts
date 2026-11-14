"use client";

import { useCallback, useRef, useState } from "react";
import { isLocked, isMissing, menuApi } from "./api";
import type { MenuPlan, PlanDetails, PlanRequest } from "./types";

/** The calm "reading your event" state stays up at least this long, so it never flashes. */
const MIN_PLANNING_MS = 900;

export type PlannerStatus = "idle" | "planning" | "ready" | "error";

export interface Planner {
  status: PlannerStatus;
  plan?: MenuPlan;
  /** The request the shown plan answers, for "Edit". */
  request?: PlanRequest;
  /** Guests before the last re-plan, so the screen can say what changed. */
  previousGuests?: number;
  error?: string;
  run(request: PlanRequest): Promise<void>;
  /** Plans the same event again for a new guest count, naming the menu it changes. */
  rescale(guests: number, menuId: string): Promise<void>;
  reset(): void;
}

function sentenceOf(error: unknown): string {
  if (isMissing(error)) return "The menu planner is not ready yet. Try again in a minute.";
  if (isLocked(error)) return "Sign in to plan an event.";
  return error instanceof Error ? error.message : "That did not work. Try again.";
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One event plan at a time: a new request replaces an answer still on its way. */
export function usePlanner(): Planner {
  const [state, setState] = useState<Omit<Planner, "run" | "rescale" | "reset">>({ status: "idle" });
  const latest = useRef(0);

  const load = useCallback(async (request: PlanRequest, calm: boolean, keep?: { plan: MenuPlan; guests: number }) => {
    const ticket = ++latest.current;
    setState((current) => ({ ...current, status: "planning", error: undefined, plan: keep?.plan ?? current.plan }));
    try {
      const [plan] = await Promise.all([menuApi.plan(request), calm ? wait(MIN_PLANNING_MS) : undefined]);
      if (ticket !== latest.current) return;
      setState({ status: "ready", plan, request, previousGuests: keep?.guests });
    } catch (error) {
      if (ticket !== latest.current) return;
      setState((current) => ({ ...current, status: "error", error: sentenceOf(error) }));
    }
  }, []);

  const run = useCallback((request: PlanRequest) => load(request, true), [load]);

  const rescale = useCallback(
    async (guests: number, menuId: string) => {
      const plan = state.plan;
      if (!plan) return;
      const before = plan.event.guests;
      const details: PlanDetails = {
        guests,
        date: plan.event.date,
        occasion: plan.event.occasion,
        dietary: plan.event.dietary,
      };
      const budget = state.request && "budgetPerGuest" in state.request ? state.request.budgetPerGuest : undefined;
      if (budget) details.budgetPerGuest = budget;
      // A plan that asked for the guest count has no menu to compare with: plan afresh.
      if (!before || !plan.menus.some((menu) => menu.id === menuId)) {
        await load(details, false);
        return;
      }
      await load({ ...details, previous: { menuId, guests: before } }, false, { plan, guests: before });
    },
    [load, state.plan, state.request],
  );

  const reset = useCallback(() => {
    latest.current++;
    setState({ status: "idle" });
  }, []);

  return { ...state, run, rescale, reset };
}
