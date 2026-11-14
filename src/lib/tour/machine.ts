/**
 * The walkthrough as a pure state machine. It knows the order of the steps and what each press of
 * Next, Back or Escape does; the runner in the browser performs the actions and reports outcomes.
 */

export type TourStatus = "closed" | "intro" | "starting" | "step" | "end" | "paused";

/** "done": the step's outcome is on screen. "timeout": it did not arrive in time and the tour may go on. */
export type Outcome = "done" | "timeout";

/** What the machine needs to know about each step. */
export interface PlanStep {
  id: string;
  /** Next first performs this step's press action (for example, approving) before moving on. */
  press?: boolean;
  /** The least time the card stays once the step's outcome is in, so the person can read what it says. */
  readMs?: number;
  /** The same after the press action has settled. */
  pressReadMs?: number;
}

export interface TourState {
  status: TourStatus;
  index: number;
  outcomes: Partial<Record<string, Outcome>>;
  /** Steps whose entry action has been started, so Back never repeats it. */
  performed: string[];
  /** Steps whose press action has been started. */
  pressed: string[];
  /** Steps whose press action has finished, by the tour or by the person. */
  settled: string[];
  /** Cards that have been on screen for their reading time, by {@link readKey}. */
  read: string[];
  /** The tour changed the log and has not restored it yet. */
  tampered: boolean;
  /** The runs the tour itself started, by scene, so it spotlights those and never another run. */
  runs: Partial<Record<string, string>>;
  error?: string;
}

export type TourEvent =
  | { type: "open" }
  | { type: "begin" }
  | { type: "failed"; message: string }
  | { type: "started" }
  | { type: "next" }
  | { type: "back" }
  | { type: "close" }
  | { type: "resume" }
  | { type: "performed"; step: string }
  | { type: "outcome"; step: string; outcome: Outcome }
  | { type: "settled"; step: string }
  | { type: "read"; key: string }
  | { type: "tampered"; value: boolean }
  | { type: "run"; scene: string; id: string };

export const CLOSED: TourState = { status: "closed", index: 0, outcomes: {}, performed: [], pressed: [], settled: [], read: [], tampered: false, runs: {} };

function add(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/** The card on screen, for its reading time: the step, or the step after its press action settled. */
export function readKey(step: PlanStep, state: Pick<TourState, "settled">): string {
  return step.press && state.settled.includes(step.id) ? `${step.id}:press` : step.id;
}

/** How long the card on screen asks to be read before Next; 0 when it has been, or asks for no time. */
export function readMsOf(step: PlanStep, state: Pick<TourState, "settled" | "read">): number {
  const key = readKey(step, state);
  if (state.read.includes(key)) return 0;
  return (key === step.id ? step.readMs : step.pressReadMs) ?? 0;
}

/**
 * Next is enabled once the step's outcome is in (or it timed out) and the card has been read; a pending press counts
 * as one more Next.
 */
export function canGoNext(plan: readonly PlanStep[], state: TourState): boolean {
  if (state.status !== "step") return false;
  const step = plan[state.index];
  if (!step || !state.outcomes[step.id] || readMsOf(step, state) > 0) return false;
  return !(step.press && state.pressed.includes(step.id) && !state.settled.includes(step.id));
}

/** True while Next would perform the step's press action instead of moving on. */
export function pressPending(plan: readonly PlanStep[], state: TourState): boolean {
  const step = plan[state.index];
  return Boolean(state.status === "step" && step?.press && !state.settled.includes(step.id));
}

function next(plan: readonly PlanStep[], state: TourState): TourState {
  if (!canGoNext(plan, state)) return state;
  const step = plan[state.index];
  if (pressPending(plan, state)) return { ...state, pressed: add(state.pressed, step.id) };
  if (state.index >= plan.length - 1) return { ...state, status: "end" };
  return { ...state, index: state.index + 1 };
}

/** The end card is the last word: Back from it does nothing, and only a new start shows a step again. */
function back(state: TourState): TourState {
  if (state.status === "step" && state.index > 0) return { ...state, index: state.index - 1 };
  return state;
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
      return state.status === "intro" ? { ...state, status: "starting", error: undefined } : state;
    case "failed":
      return state.status === "starting" ? { ...state, status: "intro", error: event.message } : state;
    case "started":
      return state.status === "starting" ? { ...CLOSED, status: "step" } : state;
    case "next":
      return next(plan, state);
    case "back":
      return back(state);
    case "close":
      return close(state);
    case "resume":
      return state.status === "paused" ? { ...state, status: "step" } : state;
    case "performed":
      return { ...state, performed: add(state.performed, event.step) };
    case "outcome":
      if (state.outcomes[event.step] === "done") return state;
      return { ...state, outcomes: { ...state.outcomes, [event.step]: event.outcome } };
    case "settled":
      return { ...state, settled: add(state.settled, event.step) };
    case "read":
      return { ...state, read: add(state.read, event.key) };
    case "tampered":
      return { ...state, tampered: event.value };
    case "run":
      return { ...state, runs: { ...state.runs, [event.scene]: event.id } };
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
    pressed: strings(value.pressed),
    settled: strings(value.settled),
    read: strings(value.read),
    tampered: value.tampered === true,
    runs: stringRecord(value.runs),
  };
}

/**
 * Applies `?tour=` to a restored state. "start" (or "1") opens the intro, whatever came before. A step id resumes that step when
 * the saved story reached it; without a saved story there is nothing to resume, so the intro opens. "end" is never
 * honoured: the end card belongs to the moment the tour finished, not to an address.
 */
export function fromUrl(plan: readonly PlanStep[], state: TourState, param: string | null): TourState {
  if (param === null) return state;
  if (param === "start" || param === "1") return state.status === "intro" ? state : { ...CLOSED, status: "intro", tampered: state.tampered };
  if (param === "end") return state;
  const index = plan.findIndex((step) => step.id === param);
  if (index < 0 || state.status === "closed" || state.status === "intro") return { ...CLOSED, status: "intro", tampered: state.tampered };
  const reached = index === 0 || Boolean(state.outcomes[plan[index - 1].id]);
  return reached ? { ...state, status: "step", index } : { ...state, status: "step" };
}

/**
 * Whether a step's press action has settled: its outcome is on screen and, when only Next may settle it, Next was
 * pressed; or Next was pressed and the wait ran out.
 */
export function pressSettles(press: { requirePress?: boolean }, pressed: boolean, done: boolean, timedOut: boolean): boolean {
  if (done) return pressed || !press.requirePress;
  return pressed && timedOut;
}
