/**
 * The walkthrough as a pure state machine. It knows the order of the steps and what each press of Next, Back or
 * Escape does; the runner in the browser performs the actions and reports outcomes. Next always moves on at once:
 * a step whose result is still coming says so on its card and never holds the visitor.
 */

export type TourStatus = "closed" | "intro" | "starting" | "step" | "end" | "paused";

/** "done": the step's result is on screen. "timeout": it did not arrive in time; the card says so. */
export type Outcome = "done" | "timeout";

/** What the machine needs to know about each step. */
export interface PlanStep {
  id: string;
}

export interface TourState {
  status: TourStatus;
  index: number;
  outcomes: Partial<Record<string, Outcome>>;
  /** One-shot actions already started, by key ("enter:basket", "leave:phone"), so Back or a reload never repeats one. */
  performed: string[];
  /** The tour changed the record and has not put it back yet. */
  tampered: boolean;
  /** The page each step runs on in this build, chosen once at Start. */
  routes: Partial<Record<string, string>>;
  /** The weekly basket the tour started, once the server named it. */
  basketId?: string;
  /** When Start was pressed: a basket created after it belongs to this tour. */
  since?: string;
  error?: string;
}

export type TourEvent =
  | { type: "open" }
  | { type: "begin"; at: string }
  | { type: "failed"; message: string }
  | { type: "started"; routes: Partial<Record<string, string>> }
  | { type: "next" }
  | { type: "back" }
  | { type: "close" }
  | { type: "resume" }
  | { type: "performed"; key: string }
  | { type: "outcome"; step: string; outcome: Outcome }
  | { type: "tampered"; value: boolean }
  | { type: "basket"; id: string };

export const CLOSED: TourState = { status: "closed", index: 0, outcomes: {}, performed: [], tampered: false, routes: {} };

function add(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/** The end card is the last word: Back from it does nothing, and only a new start shows a step again. */
function back(state: TourState): TourState {
  if (state.status === "step" && state.index > 0) return { ...state, index: state.index - 1 };
  return state;
}

function next(plan: readonly PlanStep[], state: TourState): TourState {
  if (state.status !== "step") return state;
  if (state.index >= plan.length - 1) return { ...state, status: "end" };
  return { ...state, index: state.index + 1 };
}

function close(state: TourState): TourState {
  switch (state.status) {
    case "step":
      return { ...state, status: "paused" };
    case "closed":
      return state;
    default:
      return { ...CLOSED, tampered: state.tampered };
  }
}

export function reduce(plan: readonly PlanStep[], state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case "open":
      return { ...CLOSED, status: "intro", tampered: state.tampered };
    case "begin":
      return state.status === "intro" ? { ...state, status: "starting", since: event.at, error: undefined } : state;
    case "failed":
      return state.status === "starting" ? { ...state, status: "intro", error: event.message } : state;
    case "started":
      return state.status === "starting" ? { ...CLOSED, status: "step", since: state.since, routes: event.routes } : state;
    case "next":
      return next(plan, state);
    case "back":
      return back(state);
    case "close":
      return close(state);
    case "resume":
      return state.status === "paused" ? { ...state, status: "step" } : state;
    case "performed":
      return { ...state, performed: add(state.performed, event.key) };
    case "outcome":
      if (state.outcomes[event.step] === "done") return state;
      return { ...state, outcomes: { ...state.outcomes, [event.step]: event.outcome } };
    case "tampered":
      return { ...state, tampered: event.value };
    case "basket":
      return { ...state, basketId: event.id };
  }
}

const STATUSES: readonly TourStatus[] = ["closed", "intro", "starting", "step", "end", "paused"];

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringRecord(value: unknown): Partial<Record<string, string>> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Reads a saved state back. Anything malformed gives the closed state; a save made mid-start resumes at the intro,
 * because the reset it was waiting for did not finish. A finished tour stays finished: the end card shows once.
 */
export function restore(plan: readonly PlanStep[], raw: unknown): TourState {
  if (!raw || typeof raw !== "object") return CLOSED;
  const value = raw as Record<string, unknown>;
  const status = STATUSES.find((item) => item === value.status);
  const index = typeof value.index === "number" && Number.isInteger(value.index) ? value.index : -1;
  if (!status || index < 0 || index >= plan.length) return CLOSED;
  if (status === "end" || status === "closed") return { ...CLOSED, tampered: value.tampered === true };
  const outcomes: Partial<Record<string, Outcome>> = {};
  if (value.outcomes && typeof value.outcomes === "object") {
    for (const [id, outcome] of Object.entries(value.outcomes as Record<string, unknown>)) {
      if (outcome === "done" || outcome === "timeout") outcomes[id] = outcome;
    }
  }
  return {
    status: status === "starting" ? "intro" : status,
    index,
    outcomes,
    performed: strings(value.performed),
    tampered: value.tampered === true,
    routes: stringRecord(value.routes),
    basketId: text(value.basketId),
    since: text(value.since),
  };
}

/**
 * Applies `?tour=` to a restored state. "start" (or "1") opens the intro, whatever came before. A step id resumes that
 * step when the saved story reached it; without a saved story there is nothing to resume, so the intro opens. "end" is
 * never honoured: the end card belongs to the moment the tour finished, not to an address.
 */
export function fromUrl(plan: readonly PlanStep[], state: TourState, param: string | null): TourState {
  if (param === null) return state;
  if (turnsOff(param)) return { ...CLOSED, tampered: state.tampered };
  if (param === "start" || param === "1") return state.status === "intro" ? state : { ...CLOSED, status: "intro", tampered: state.tampered };
  if (param === "end") return state;
  const index = plan.findIndex((step) => step.id === param);
  if (index < 0 || state.status === "closed" || state.status === "intro") return { ...CLOSED, status: "intro", tampered: state.tampered };
  return index <= state.index ? { ...state, status: "step", index } : { ...state, status: "step" };
}

/** Pages that never open the walkthrough by themselves: the approval phone, and the about page a judge does not land on. */
const NO_AUTO_OPEN = [/^\/approve(\/|$)/, /^\/about(\/|$)/];

/** `?tour=off` (or `0`) keeps the walkthrough closed and remembers that for the rest of the browser session. */
export function turnsOff(param: string | null): boolean {
  return param === "off" || param === "0";
}

/**
 * The Start card opens by itself when a visitor lands on or reloads a page of the product, until they close it once in
 * this browser session. A walkthrough already under way, a `?tour=` address and the pages above are left alone.
 */
export function autoOpen(state: TourState, where: { path: string; param: string | null; dismissed: boolean }): TourState {
  if (where.param !== null || where.dismissed || state.status !== "closed") return state;
  if (NO_AUTO_OPEN.some((page) => page.test(where.path))) return state;
  return { ...CLOSED, status: "intro", tampered: state.tampered };
}
