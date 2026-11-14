import { substitutionChoice } from "@/lib/console/format/substitution";
import type { ConditionId, StoryFacts } from "./facts";
import { RULE_ATTEMPTS } from "./facts";
import type { PlanStep, TourState } from "./machine";
import { runOf } from "./targets";

/** What the tour does in the product itself. The runner in the browser carries each one out. */
export type ActionId = "typeRequest" | "sendRequest" | "startOverLimit" | "approveOnPhone" | "showDemand" | "startBreakMandate" | "awaitLogEdit";

export interface StepCopy {
  /** The one sentence a restaurant owner reads first. */
  title: string;
  /** A short second line, at most. */
  detail?: string;
}

/** Where the spotlight goes: the first visible match of `target`, and of `also` at the same time. */
export interface Spot {
  target: readonly string[];
  also?: readonly string[];
}

export interface PressAction {
  action: ActionId;
  label: string;
  working: string;
  until: ConditionId;
  timeoutMs: number;
  /** Only Next settles it; without this, the person doing it in the product (approving on the phone) counts too. */
  requirePress?: boolean;
  /** Where the spotlight moves once the press has settled. */
  spot?: Spot;
  copy: (facts: StoryFacts) => StepCopy;
}

export interface TourStep extends PlanStep, Spot {
  id: string;
  route: string;
  /** Keep the page at its top, so its title stays in view, when the target fits there. */
  pinTop?: boolean;
  /** "phone" shows Maria's phone with the real approval page once the order is waiting. */
  view: "spotlight" | "phone";
  enter?: ActionId;
  until: ConditionId;
  timeoutMs: number;
  /** The quiet label on Next while the product is still working. */
  waiting: string;
  /** The label on Next once the outcome is in, when Next does more than move on. */
  nextLabel?: string;
  /** The step's outcome counts as on screen only once this matches too (for example, the log head showing broken). */
  shownWhen?: string;
  /** Every sentence is chosen from what is on screen now, never from what is about to be; `shown`: the outcome is. */
  copy: (facts: StoryFacts, shown: boolean) => StepCopy;
  /** Said instead of the detail line when the outcome did not arrive in time. */
  fallback: string;
  press?: boolean;
  pressAction?: PressAction;
}

/** Every Valio target falls back to the page's main region, so a page that is still changing never strands the tour. */
export const MAIN_TARGET = "main#main";
const LIVE_AGENT = [".live-agent"];
/** The newest run block: the demo was reset, so it is the one the tour just started. */
const NEWEST_RUN = '[data-tour="runs"] > .run:first-of-type';

function milkCopy(facts: StoryFacts): StepCopy {
  if (!facts.milkQuoted) {
    return { title: "The agent searches Valio Aimo’s catalogue and asks for a price.", detail: "Each new line is one step it took, in plain words." };
  }
  const title = facts.milkTotal
    ? `Valio Aimo answers with a fixed price it has signed: ${facts.milkTotal}. Nobody can change it on the way.`
    : "Valio Aimo answers with a fixed price it has signed. Nobody can change it on the way.";
  if (facts.milk?.status === "confirmed") return { title, detail: "The offer met every rule, so the order is confirmed." };
  return { title, detail: `The agent now checks the offer against ${facts.approverFirst}’s rules.` };
}

function rulesCopy(facts: StoryFacts): StepCopy {
  if (facts.milk?.status !== "confirmed" || facts.milkRulesPassed === undefined) {
    return { title: `Every order is checked against ${facts.approverFirst}’s rules before it is placed.`, detail: `${facts.approver} signed these rules once.` };
  }
  const passed = facts.milkRulesPassed;
  return {
    title:
      passed === facts.rulesTotal
        ? `All ${passed} of ${facts.approverFirst}’s rules passed, so the agent ordered on its own.`
        : `${passed} of ${facts.rulesTotal} of ${facts.approverFirst}’s rules passed, and none stopped the order.`,
    detail: `${facts.approver} signed these rules once. Each tick is one rule, checked on this order.`,
  };
}

function overLimitCopy(facts: StoryFacts): StepCopy {
  if (!facts.overLimit) return { title: "Now the agent places a larger order." };
  return {
    title:
      facts.overBy && facts.limit
        ? `This order is ${facts.overBy} over the ${facts.limit} limit. The agent stops, and ${facts.approverFirst} gets it on her phone.`
        : `This order is over the limit. The agent stops, and ${facts.approverFirst} gets it on her phone.`,
    detail: "Tap Approve and sign on the phone, or press Next and the tour approves it for you.",
  };
}

function decidedCopy(facts: StoryFacts): StepCopy {
  const who = facts.approverFirst;
  switch (facts.overLimit?.status) {
    case "confirmed":
      return { title: `${who} approved it on her phone. Her approval is signed and logged.`, detail: "Only a person can approve. The agent has no key that could do it." };
    case "blocked":
      return {
        title: `${who} approved it, but the stock ran short in the meantime, so the order was stopped. Nothing was bought.`,
        detail: "Approving checks the mandate and the stock again. That check is signed and logged too.",
      };
    case "rejected":
      return { title: `${who} rejected it on her phone. Her decision is signed and logged.`, detail: "Only a person can decide. The agent has no key that could do it." };
    default:
      return { title: `The order is still waiting for ${who}.`, detail: "Her decision did not arrive. Press Next to go on without it." };
  }
}

function stockCopy(facts: StoryFacts): StepCopy {
  if (!facts.shortStock) return { title: "The agent places its next order." };
  const title =
    facts.shortAvailable !== undefined
      ? `Short stock: Valio Aimo had only ${facts.shortAvailable} of the ${facts.shortRequested} the agent asked for.`
      : facts.shortReason
        ? `Short stock. ${facts.shortReason}`
        : "Short stock: Valio Aimo had too little of what the agent asked for.";
  return { title, detail: substitutionChoice(facts.shortStock) ?? "Valio Aimo offered a signed alternative, and the rules allowed it." };
}

function attemptsCopy(facts: StoryFacts): StepCopy {
  if (facts.refused >= RULE_ATTEMPTS) {
    return { title: "Four attempts to break the rules. Each one was refused, and each refusal is signed.", detail: "Allergens, a changed price, a raised limit and approving its own order." };
  }
  return {
    title: "Now the agent tries to cheat, on purpose.",
    detail: facts.refused === 0 ? "Watch each attempt appear as the agent makes it." : `Refused so far: ${facts.refused} of ${facts.attempts}.`,
  };
}

function logCopy(facts: StoryFacts, shown: boolean): StepCopy {
  if (facts.brokenAt === undefined || !shown) {
    return { title: "The agent’s last attempt: changing an entry in the log after the fact.", detail: "Your browser checks every signature in the log again." };
  }
  return {
    title: `It changed entry ${facts.brokenAt} of this demo’s log. Your browser caught it at once.`,
    detail: "Approvals stay paused until the log is restored from the last signed checkpoint. If a customer disputes an order, both sides check the same record in seconds.",
  };
}

export const STEPS: readonly TourStep[] = [
  {
    id: "request",
    readMs: 5_000,
    route: "/buyer",
    target: ['[data-tour="composer"]', ".live-agent .composer"],
    pinTop: true,
    view: "spotlight",
    enter: "typeRequest",
    until: "now",
    timeoutMs: 15_000,
    waiting: "Typing the request…",
    nextLabel: "Send it",
    copy: () => ({
      title: "A hotel kitchen’s AI agent is about to ask Valio Aimo for milk. No person is involved.",
      detail: "The request is typed in. Press Send it and watch the agent work.",
    }),
    fallback: "The composer is slow to appear. Press Send it and the story goes on.",
  },
  {
    id: "offer",
    readMs: 5_000,
    route: "/buyer",
    target: [runOf("milk")],
    also: LIVE_AGENT,
    view: "spotlight",
    enter: "sendRequest",
    until: "milkConfirmed",
    timeoutMs: 25_000,
    waiting: "Agent is working…",
    copy: milkCopy,
    fallback: "The offer is taking longer than usual. Press Next and it finishes in the background.",
  },
  {
    id: "rules",
    readMs: 7_000,
    route: "/buyer",
    target: [`${runOf("milk")} [data-tour="checks"]`, '[data-tour="orb"]', ".live-agent-stage"],
    view: "spotlight",
    until: "milkShown",
    timeoutMs: 10_000,
    waiting: "Checking the rules…",
    copy: rulesCopy,
    fallback: "The order is still being confirmed. Press Next to go on.",
  },
  {
    id: "phone",
    readMs: 9_000,
    pressReadMs: 7_000,
    route: "/buyer",
    target: ['[data-tour-scene="over-limit"]', '[data-tour="composer"]'],
    view: "phone",
    enter: "startOverLimit",
    until: "overLimitWaiting",
    timeoutMs: 25_000,
    waiting: "Agent is working…",
    copy: overLimitCopy,
    fallback: "The order is slow to arrive. Press Next to go on without it.",
    press: true,
    pressAction: {
      action: "approveOnPhone",
      label: "Approve it",
      working: "Signing…",
      until: "overLimitDecided",
      timeoutMs: 15_000,
      copy: decidedCopy,
    },
  },
  {
    id: "stock",
    readMs: 10_000,
    route: "/buyer",
    target: [`${runOf("over-limit")} .run-reason`, runOf("over-limit")],
    view: "spotlight",
    until: "shortStockDone",
    timeoutMs: 20_000,
    waiting: "Agent is working…",
    copy: stockCopy,
    fallback: "The agent is still working on this one. Press Next to go on.",
  },
  {
    id: "valio",
    readMs: 7_000,
    pressReadMs: 7_000,
    route: "/valio",
    target: ['[data-tour="valio-agents"]', 'section[aria-labelledby="agents-title"]', MAIN_TARGET],
    view: "spotlight",
    until: "now",
    timeoutMs: 8_000,
    waiting: "Opening Valio Aimo’s side…",
    copy: () => ({
      title: "This is Valio Aimo’s side. It sees every agent that buys, and what each one asked for.",
      detail: "Which app each agent runs in, how often it called and what it bought.",
    }),
    fallback: "This page is still loading. Press Next to go on.",
    press: true,
    pressAction: {
      action: "showDemand",
      label: "Show the demand",
      working: "Moving…",
      until: "now",
      timeoutMs: 2_000,
      requirePress: true,
      spot: {
        // The flow ends in the demand that was not served, so one spotlight carries both; the panel is the fallback.
        target: ['[data-tour="valio-flow"]', '[data-tour="valio-unserved"]', 'section[aria-labelledby="unserved-title"]', MAIN_TARGET],
      },
      copy: () => ({
        title: "It also sees where demand went, and what it could not serve, so it knows what to stock next.",
        detail: "A webshop log never shows the orders that did not happen.",
      }),
    },
  },
  {
    id: "cheat",
    readMs: 6_000,
    route: "/buyer",
    target: [`${runOf("break-mandate")} [data-tour="attempts"]`, `${NEWEST_RUN} [data-tour="attempts"]`, `${NEWEST_RUN} .attempts`, runOf("break-mandate")],
    view: "spotlight",
    enter: "startBreakMandate",
    until: "rulesRefused",
    timeoutMs: 30_000,
    waiting: "Agent is trying…",
    copy: attemptsCopy,
    fallback: "The attempts are slow to arrive. Press Next to go on.",
  },
  {
    id: "log",
    readMs: 9_000,
    route: "/buyer/log",
    target: ['[data-tour="log-head"]', ".log-head"],
    shownWhen: '[data-tour="log-head"]:not([data-state="checking"]):not([data-state="empty"])',
    view: "spotlight",
    enter: "awaitLogEdit",
    until: "logBroken",
    timeoutMs: 20_000,
    waiting: "Checking the log…",
    copy: logCopy,
    fallback: "The check is slow to finish. Press Next to go on.",
  },
];

/** Where the spotlight is now: after a settled press, at the press action's own spot. */
export function spotOf(step: TourStep, state: Pick<TourState, "settled">): Spot {
  if (step.pressAction?.spot && state.settled.includes(step.id)) return step.pressAction.spot;
  return { target: step.target, also: step.also };
}

/** The sentence for the step as the product stands: the press action's once it has settled. */
export function copyOf(step: TourStep, state: Pick<TourState, "settled" | "outcomes">, facts: StoryFacts): StepCopy {
  return step.pressAction && state.settled.includes(step.id) ? step.pressAction.copy(facts) : step.copy(facts, state.outcomes[step.id] === "done");
}

/** The closing card: what was shown, each line tied to the judging criterion it answers. */
export const END_LINES: readonly { text: string; criteria: string }[] = [
  { text: "An AI agent bought at a signed, fixed price, and a person approved past the limit.", criteria: "Working end-to-end demo · Autonomy and controls" },
  { text: "Short stock got a signed alternative. Every attempt to cheat was refused, and an edited log was caught.", criteria: "Robustness to exception situations" },
  { text: "Valio Aimo sees every agent and the demand it missed. Any agent can connect.", criteria: "Solving the user need · Openness" },
];
