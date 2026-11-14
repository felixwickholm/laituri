"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TourState } from "@/lib/tour/machine";
import { STEPS, copyOf, routeOf, spotGroups } from "@/lib/tour/steps";
import { EndCard } from "./EndCard";
import { IntroCard } from "./IntroCard";
import { PhoneStage } from "./PhoneStage";
import { TourCard } from "./TourCard";
import { tourStore } from "./tour-store";
import { useSpotlight } from "./useSpotlight";
import { useTourFacts } from "./useTourFacts";
import { goNext } from "./useTourRunner";

const FOCUSABLE = 'button:not([disabled]), a[href], iframe, input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Keeps Tab inside the tour's cards and the phone, wrapping at either end. */
function trapTab(event: ReactKeyboardEvent<HTMLDivElement>): void {
  if (event.key !== "Tab") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** The open tour: the dimmed page with its spotlight, and the Start, step or end card. */
export function TourLayer({ state }: { state: TourState }) {
  const router = useRouter();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const dim = useRef<SVGPathElement>(null);
  const ring = useRef<SVGPathElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const facts = useTourFacts(state);

  // While the tour moves to the step's page, the card waits: its sentence is about that page, not this one.
  const candidate = state.status === "step" ? STEPS[state.index] : undefined;
  const step = candidate && routeOf(candidate, state.routes) === pathname ? candidate : undefined;
  const outcome = step ? state.outcomes[step.id] : undefined;
  const phoneFor = step?.view === "phone" && facts.basket && (facts.orangeLine || facts.answeredLine) ? facts.basket.id : undefined;
  const groups = step && !phoneFor ? spotGroups(step) : null;
  useSpotlight(groups, { dim, ring, card: cardRef }, { floatCard: step !== undefined && phoneFor === undefined, pinTop: false });

  const next = useCallback(() => goNext(tourStore.getSnapshot()), []);
  const back = useCallback(() => tourStore.dispatch({ type: "back" }), []);
  const close = useCallback(() => tourStore.dispatch({ type: "close" }), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight" && tourStore.getSnapshot().status === "step") next();
      else if (event.key === "ArrowLeft") back();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, close]);

  const phoneShown = phoneFor !== undefined;
  useEffect(() => {
    const layer = root.current;
    if (layer && !layer.contains(document.activeElement)) layer.querySelector<HTMLElement>("[data-tour-next]")?.focus({ preventScroll: true });
  }, [state.status, state.index, phoneShown, step]);

  useEffect(
    () => () => {
      const { status } = tourStore.getSnapshot();
      const back = tourStore.returnFocus;
      if (status === "closed" && back?.isConnected) back.focus({ preventScroll: true });
    },
    [],
  );

  const copy = step ? copyOf(step, facts, outcome === "done") : undefined;
  const announcement = step && copy ? `Step ${state.index + 1} of ${STEPS.length}. ${copy.title} ${copy.detail ?? ""}` : "";

  const card =
    step && copy ? (
      <div ref={cardRef} key="card" className="tour-float" data-mode={phoneShown ? "beside-phone" : "float"}>
        <TourCard
          index={state.index}
          total={STEPS.length}
          copy={copy}
          note={outcome === "timeout" ? step.late : undefined}
          flow={step.flow?.(facts, outcome === "done")}
          working={outcome === undefined}
          last={state.index === STEPS.length - 1}
          onNext={next}
          onBack={back}
          onClose={close}
        />
      </div>
    ) : null;

  return (
    <div ref={root} className="tour" data-status={state.status} role="dialog" aria-modal="true" aria-labelledby="tour-title" onKeyDown={trapTab}>
      <svg className="tour-dim" aria-hidden="true">
        <path ref={dim} className="tour-dim-fill" fillRule="evenodd" />
        <path ref={ring} className="tour-ring" />
      </svg>

      {state.status === "intro" || state.status === "starting" ? (
        <div className="tour-center">
          <IntroCard
            starting={state.status === "starting"}
            error={state.error}
            steps={STEPS.length}
            onStart={() => tourStore.dispatch({ type: "begin", at: new Date().toISOString() })}
            onClose={close}
          />
        </div>
      ) : null}

      {state.status === "end" ? (
        <div className="tour-center">
          <EndCard
            onGo={(href) => {
              window.history.replaceState(window.history.state, "", window.location.pathname);
              close();
              router.push(href);
            }}
            onClose={close}
          />
        </div>
      ) : null}

      {phoneFor ? (
        <div key="phone" className="tour-phone-layout">
          <PhoneStage basketId={phoneFor} />
          {card}
        </div>
      ) : (
        card
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
