import type { ConditionId, StoryFacts } from "./facts";
import { takenInstead } from "./facts";
import type { PlanStep } from "./machine";

/** What the tour does in the product itself. The runner in the browser carries each one out. */
export type ActionId = "askForMilk" | "startOverLimit" | "approveOnPhone" | "tamperLog";

export interface StepCopy {
  /** The one sentence a restaurant owner reads first. */
  title: string;
  /** A short second line, at most. */
  detail?: string;
}

export interface TourStep extends PlanStep {
  id: string;
  route: string;
  /** Selectors tried in order while the step's outcome is still coming; the first match is spotlit. */
  target: readonly string[];
  /** Where the spotlight moves once the outcome is on screen. Defaults to `target`. */
  doneTarget?: readonly string[];
  /** "phone" shows Maria's phone with the real approval page once the order is waiting. */
  view: "spotlight" | "phone";
  enter?: ActionId;
  until: ConditionId;
  timeoutMs: number;
  /** The quiet label on Next while the product is still working. */
  waiting: string;
  copy: (facts: StoryFacts) => StepCopy;
  /** Said instead of the detail line when the outcome did not arrive in time. */
  fallback: string;
  press?: boolean;
  pressAction?: { action: ActionId; label: string; working: string; until: ConditionId; timeoutMs: number; copy: (facts: StoryFacts) => StepCopy };
}

/** Every Valio target falls back to the page's main region, so a page that is still changing never strands the tour. */
export const MAIN_TARGET = "main#main";
const RUNS = '[data-tour="runs"] .run:first-of-type';

export const STEPS: readonly TourStep[] = [
  {
    id: "request",
    route: "/buyer",
    target: ['[data-tour="composer"]', ".live-agent .composer"],
    doneTarget: [RUNS, '[data-tour="composer"]'],
    view: "spotlight",
    enter: "askForMilk",
    until: "agentWorking",
    timeoutMs: 15_000,
    waiting: "Sending the request…",
    copy: () => ({
      title: "A hotel kitchen’s AI agent asks Valio Aimo for milk. No person is involved.",
      detail: "The request: 1,000 litres of lactose-free milk by Monday.",
    }),
    fallback: "The agent is slow to start. Press Next and the story goes on.",
  },
  {
    id: "offer",
    route: "/buyer",
    target: [RUNS],
    view: "spotlight",
    until: "milkConfirmed",
    timeoutMs: 25_000,
    waiting: "Agent is working…",
    copy: (facts) => ({
      title: facts.milkTotal
        ? `Valio Aimo answers with a fixed price it has signed: ${facts.milkTotal}. Nobody can change it on the way.`
        : "Valio Aimo answers with a fixed price it has signed. Nobody can change it on the way.",
      detail: "Each line is one step the agent took, in plain words.",
    }),
    fallback: "The offer is taking longer than usual. Press Next and it finishes in the background.",
  },
  {
    id: "mandate",
    route: "/buyer",
    target: ['[data-tour="orb"]', ".live-agent-stage"],
    view: "spotlight",
    until: "milkShown",
    timeoutMs: 10_000,
    waiting: "Checking the rules…",
    copy: (facts) => ({
      title: `All ${facts.milkRulesPassed ?? facts.rulesTotal} of ${facts.approverFirst}’s rules passed, so the agent ordered on its own.`,
      detail: `${facts.approver} signed these rules once. The full ring means every one of them held.`,
    }),
    fallback: "The order is still being confirmed. Press Next to go on.",
  },
  {
    id: "phone",
    route: "/buyer",
    target: ['[data-tour-scene="over-limit"]', '[data-tour="composer"]'],
    view: "phone",
    enter: "startOverLimit",
    until: "overLimitWaiting",
    timeoutMs: 25_000,
    waiting: "Agent is working…",
    copy: (facts) => ({
      title: facts.overBy
        ? `This order is ${facts.overBy} over the limit. The agent stops and ${facts.approverFirst} gets it on her phone.`
        : `The next order is over the limit. The agent stops and ${facts.approverFirst} gets it on her phone.`,
      detail: "Tap Approve on the phone, or press Next and the tour taps it for you.",
    }),
    fallback: "The order is slow to arrive. Press Next to go on without it.",
    press: true,
    pressAction: {
      action: "approveOnPhone",
      label: "Approve it",
      working: "Signing…",
      until: "overLimitDecided",
      timeoutMs: 15_000,
      copy: (facts) => ({
        title:
          facts.overLimit?.status === "confirmed"
            ? `${facts.approverFirst} approved it on her phone. Her approval is signed and logged.`
            : `${facts.approverFirst} decided on her phone. Her decision is signed and logged.`,
        detail: "Only a person can approve. The agent has no key that could do it.",
      }),
    },
  },
  {
    id: "stock",
    route: "/buyer",
    target: [RUNS],
    view: "spotlight",
    until: "shortStockDone",
    timeoutMs: 20_000,
    waiting: "Agent is working…",
    copy: (facts) => {
      const instead = takenInstead(facts.shortStock);
      return {
        title:
          facts.shortAvailable !== undefined
            ? `Valio Aimo had only ${facts.shortAvailable} of the ${facts.shortRequested} the agent wanted. It offered a signed alternative, and the rules allowed it.`
            : "Valio Aimo had too little of one product. It offered a signed alternative, and the rules allowed it.",
        detail: instead ? `The agent took ${instead} instead, without asking anyone.` : undefined,
      };
    },
    fallback: "The agent is still working on this one. Press Next to go on.",
  },
  {
    id: "valio-agents",
    route: "/valio",
    target: ['[data-tour="valio-agents"]', 'section[aria-labelledby="agents-title"]', MAIN_TARGET],
    view: "spotlight",
    until: "now",
    timeoutMs: 8_000,
    waiting: "Opening Valio Aimo’s side…",
    copy: () => ({
      title: "This is Valio Aimo’s side. It sees every agent that buys, and what each one asked for.",
      detail: "Each one shows which app it runs in, how often it called and what it bought.",
    }),
    fallback: "This page is still loading. Press Next to go on.",
  },
  {
    id: "valio-demand",
    route: "/valio",
    target: ['[data-tour="valio-demand"]', 'section[aria-labelledby="unserved-title"]', MAIN_TARGET],
    view: "spotlight",
    until: "now",
    timeoutMs: 8_000,
    waiting: "Loading demand…",
    copy: () => ({
      title: "It also sees the demand it could not serve, so it knows what to stock next.",
      detail: "Missed cut-offs and products it does not stock, each with what it was worth.",
    }),
    fallback: "This panel is still loading. Press Next to go on.",
  },
  {
    id: "log",
    route: "/buyer/log",
    target: ['[data-tour="tamper"]', ".demo-control"],
    doneTarget: ['[data-tour="log-head"]', ".log-head"],
    view: "spotlight",
    enter: "tamperLog",
    until: "logBroken",
    timeoutMs: 15_000,
    waiting: "Changing one entry…",
    copy: (facts) => ({
      title: "Every step is signed and chained. Change one entry and everyone can see where.",
      detail:
        facts.brokenAt !== undefined
          ? `The tour just changed entry ${facts.brokenAt} on the server. Your browser caught it at once.`
          : "The tour changes one stored entry on the server, the way an attacker would.",
    }),
    fallback: "The check is slow to finish. Press Next to go on.",
  },
];

/** The closing card: what was shown, each line tied to the judging criterion it answers. */
export const END_LINES: readonly { text: string; criteria: string }[] = [
  { text: "An AI agent bought at a signed, fixed price, and a person decided past the limit.", criteria: "Working end-to-end demo · Autonomy and controls" },
  { text: "Short stock got a signed alternative. An edited log was caught at once.", criteria: "Robustness to exception situations" },
  { text: "Valio Aimo sees every agent and the demand it missed. Any agent can connect.", criteria: "Solving the user need · Openness" },
];
