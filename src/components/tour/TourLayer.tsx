"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useConsole } from "@/lib/console/store";
import { storyFacts } from "@/lib/tour/facts";
import { canGoNext, pressPending, readKey, readMsOf, type TourState } from "@/lib/tour/machine";
import { STEPS, copyOf, spotOf } from "@/lib/tour/steps";
import { resolveTargets } from "@/lib/tour/targets";
import { prepareDemo } from "./actions";
import { EndCard } from "./EndCard";
import { IntroCard } from "./IntroCard";
import { PhoneStage } from "./PhoneStage";
import { TourCard } from "./TourCard";
import { tourStore } from "./tour-store";
import { useSpotlight } from "./useSpotlight";

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

/** The open tour: the dimmed page with its spotlight, and the intro, step or end card. */
export function TourLayer({ state }: { state: TourState }) {
  const snapshot = useConsole();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const dim = useRef<SVGPathElement>(null);
  const ring = useRef<SVGPathElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const facts = storyFacts(snapshot);

  const pathname = usePathname();
  // While the tour moves to the step's page, the card waits: its sentence is about that page, not this one.
  const step = state.status === "step" && STEPS[state.index].route === pathname ? STEPS[state.index] : undefined;
  const outcome = step ? state.outcomes[step.id] : undefined;
  const phoneOrder = step?.view === "phone" ? facts.overLimit : undefined;
  const spot = step && !phoneOrder ? spotOf(step, state) : undefined;
  // A run target is left out until the tour has started that run; an empty group would match nothing anyway.
  const groups = spot ? [spot.target, spot.also ?? []].map((group) => resolveTargets(group, state.runs)).filter((group) => group.length > 0) : null;
  useSpotlight(groups, { dim, ring, card: cardRef }, { floatCard: step !== undefined && phoneOrder === undefined, pinTop: Boolean(step?.pinTop) });

  const next = useCallback(() => tourStore.dispatch({ type: "next" }), []);
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

  const phoneShown = phoneOrder !== undefined;
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

  const pressing = Boolean(step?.press && state.pressed.includes(step.id) && !state.settled.includes(step.id));
  const waiting = step !== undefined && outcome === undefined;
  const nextLabel = !step
    ? "Next"
    : waiting
      ? step.waiting
      : pressing
        ? (step.pressAction?.working ?? "Working…")
        : pressPending(STEPS, state)
          ? (step.pressAction?.label ?? "Next")
          : state.index === STEPS.length - 1
            ? "Finish"
            : (step.nextLabel ?? "Next");
  const copy = step ? copyOf(step, state, facts) : undefined;
  const readLeft = step && !waiting && !pressing ? readMsOf(step, state) : 0;
  const reading = step && readLeft > 0 ? { key: readKey(step, state), ms: readLeft } : undefined;
  const announcement = step && copy ? `Step ${state.index + 1} of ${STEPS.length}. ${copy.title}` : "";

  const card =
    step && copy ? (
      <div ref={cardRef} key="card" className="tour-float" data-mode={phoneShown ? "beside-phone" : "float"}>
        <TourCard
          index={state.index}
          total={STEPS.length}
          copy={copy}
          note={outcome === "timeout" ? step.fallback : undefined}
          nextLabel={nextLabel}
          busy={waiting || pressing}
          reading={reading}
          canNext={canGoNext(STEPS, state)}
          canBack={state.index > 0}
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
            onStart={() => tourStore.dispatch({ type: "begin" })}
            onClose={close}
          />
        </div>
      ) : null}

      {state.status === "end" ? (
        <div className="tour-center">
          <EndCard
            onGo={(href) => {
              window.history.replaceState(null, "", window.location.pathname);
              close();
              router.push(href);
            }}
            onReset={async () => {
              await prepareDemo();
              close();
            }}
            onClose={close}
          />
        </div>
      ) : null}

      {phoneOrder ? (
        <div key="phone" className="tour-phone-layout">
          <PhoneStage orderId={phoneOrder.id} approver={facts.approverFirst} />
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
