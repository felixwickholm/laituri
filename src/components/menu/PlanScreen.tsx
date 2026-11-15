"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { menuApi } from "@/lib/menu-console/api";
import { basketLines, basketTitle, changesText, deliverByFor, isoDay, planFromQuery, type SwapChoice } from "@/lib/menu-console/format";
import { usePlanner } from "@/lib/menu-console/planner";
import type { MenuOption, MenuPlan, PlanRequest } from "@/lib/menu-console/types";
import { longDay } from "@/lib/console/format/time";
import { PageHeader } from "../shell/PageHeader";
import { toast } from "../ui/toast";
import { useNow } from "../ui/useNow";
import { AskEvent } from "./AskEvent";
import { MenuOptions } from "./MenuOptions";
import { OrderedMenu } from "./OrderedMenu";
import { PlanningState } from "./PlanningState";
import { Stepper } from "./Stepper";

const RESCALE_AFTER_MS = 600;

/** Need, menu, order: one sentence or a tap in, three menus out, one press to order. */
export function PlanScreen() {
  const params = useSearchParams();
  const planner = usePlanner();
  const [editing, setEditing] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const [guests, setGuests] = useState<number>();
  const [orderingId, setOrderingId] = useState<string>();
  const [ordered, setOrdered] = useState<{ basketId: string; title: string }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const started = useRef(false);
  const now = useNow(60_000);
  const head = <PageHeader title="Plan an event" meta={<time suppressHydrationWarning>{longDay(now)}</time>} />;

  const { run } = planner;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const request = planFromQuery(params);
    if (request) void run(request);
  }, [params, run]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const plan = planner.plan;
  const shownGuests = guests ?? plan?.event.guests;

  function ask(request: PlanRequest): void {
    setEditing(false);
    setOpenId(undefined);
    setGuests(undefined);
    setOrdered(undefined);
    void planner.run(request);
  }

  function startOver(): void {
    setOrdered(undefined);
    setOpenId(undefined);
    setGuests(undefined);
    planner.reset();
  }

  function changeGuests(next: number): void {
    if (!plan) return;
    setGuests(next);
    clearTimeout(timer.current);
    const menuId = openId ?? plan.menus[Math.min(1, plan.menus.length - 1)]?.id;
    if (!menuId) return;
    timer.current = setTimeout(() => void planner.rescale(next, menuId), RESCALE_AFTER_MS);
  }

  async function order(option: MenuOption, choices: Record<string, SwapChoice>): Promise<void> {
    if (!plan) return;
    const lines = basketLines(option, choices);
    if (lines.length === 0) {
      toast("Your kitchen has everything already.", "neutral");
      return;
    }
    setOrderingId(option.id);
    const title = basketTitle(plan);
    try {
      const { basketId } = await menuApi.placeBasket({
        title,
        deliverBy: deliverByFor(plan, isoDay(Date.now())),
        source: "menu",
        menuId: option.id,
        lines,
      });
      setOrdered({ basketId, title });
    } catch (error) {
      toast(error instanceof Error ? error.message : "The order did not start. Try again.", "danger");
    } finally {
      setOrderingId(undefined);
    }
  }

  if (!plan || editing) {
    if (planner.status === "planning") return <PlanningState />;
    return (
      <div className="page plan-page">
        {head}
        <AskEvent key={editing ? "edit" : "new"} initial={planner.request} onPlan={ask} />
        {planner.status === "error" ? (
          <p className="plan-error" role="alert">
            {planner.error}
          </p>
        ) : null}
        <RecipesLink />
      </div>
    );
  }

  const rescaling = planner.status === "planning";
  return (
    <div className="page plan-page">
      {head}
      <section className="glass pad verdict plan-heard" aria-label="Your event">
        <p className="verdict-label">Your event</p>
        <h2 className="verdict-title plan-understood">{plan.understood}</h2>
        <div className="plan-heard-actions">
          <button type="button" className="btn btn-secondary big" onClick={() => setEditing(true)}>
            Edit
          </button>
          {shownGuests && !ordered ? <Stepper label="Guests" value={shownGuests} onChange={changeGuests} unit="guests" /> : null}
        </div>
        {plan.notes.length ? (
          <details className="plan-notes">
            <summary>How it was planned</summary>
            <ul>
              {plan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <p className="plan-status" role="status">
          {rescaling ? `Planning for ${shownGuests} guests…` : ""}
        </p>
      </section>

      {ordered ? (
        <OrderedMenu basketId={ordered.basketId} title={ordered.title} onNew={startOver} />
      ) : plan.needs?.includes("guests") ? (
        <AskGuests plan={plan} onPlan={ask} />
      ) : planner.status === "error" ? (
        // The last request failed: the menus on screen would answer an older event, so none is offered to order.
        <p className="plan-empty">{planner.error ?? "That did not work."} Change a detail and try again.</p>
      ) : plan.menus.length === 0 ? (
        <p className="plan-empty">No menu fits this event yet. Change a detail and try again.</p>
      ) : (
        <div className="plan-options" data-busy={rescaling}>
          <h2 className="plan-options-title">Pick a menu</h2>
          <MenuOptions
            menus={plan.menus}
            openId={openId}
            onOpen={setOpenId}
            orderingId={orderingId}
            onOrder={order}
            changesFor={(option) =>
              planner.previousGuests && plan.event.guests ? changesText(option, plan.event.guests, planner.previousGuests) : undefined
            }
          />
        </div>
      )}
      <RecipesLink />
    </div>
  );
}

const GUESTS_TO_START = 50;

/** The words gave no guest count: ask for it, keeping the day, occasion and dietary needs already read. */
function AskGuests({ plan, onPlan }: { plan: MenuPlan; onPlan: (request: PlanRequest) => void }) {
  const [guests, setGuests] = useState(GUESTS_TO_START);
  const { date, occasion, dietary } = plan.event;
  return (
    <form
      className="plan-options"
      onSubmit={(event) => {
        event.preventDefault();
        onPlan({ guests, date, ...(occasion ? { occasion } : {}), dietary });
      }}
    >
      <h2 className="plan-options-title">{plan.question ?? "How many guests?"}</h2>
      <Stepper label="Guests" value={guests} onChange={setGuests} unit="guests" />
      <button type="submit" className="btn btn-primary big">
        Plan the menu
      </button>
    </form>
  );
}

function RecipesLink() {
  return (
    <Link className="text-link plan-recipes-link" href="/buyer/plan/recipes">
      <BookOpen aria-hidden />
      See the recipes
    </Link>
  );
}
