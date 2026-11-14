import type { BasketLine } from "@/lib/contracts";
import { fillCopy, type Counts, type StepCopy } from "./copy";
import { lineWhy, type ConditionId, type TourFacts } from "./facts";
import type { PlanStep } from "./machine";

/** What the tour does in the product itself. The runner in the browser carries each one out. */
export type ActionId = "pressExample" | "startWeekly" | "resolveOnPhone";

/** Valio Aimo's challenge sheet names the flow in four words; the card shows where the story is. */
export type FlowStage = "request" | "lookup" | "order" | "approval";
export const FLOW: readonly { id: FlowStage; label: string }[] = [
  { id: "request", label: "Request" },
  { id: "lookup", label: "Lookup" },
  { id: "order", label: "Order" },
  { id: "approval", label: "Approval" },
];

/** Every target falls back to the page's main region, so a page that is still changing never strands the tour. */
export const MAIN_TARGET = "main#main";

export interface TourStep extends PlanStep {
  /** The first of these pages that exists in this build is the step's page. */
  routes: readonly string[];
  /** Spotlight: the first visible match of `target`, and of `also` at the same time; the main region when none is. */
  target: readonly string[];
  also?: readonly string[];
  /** More single targets lit at the same time, each its own cut-out (the first cards of a grid). */
  more?: readonly string[];
  /** "phone" shows the purchasing manager's phone with the real page for the waiting lines. */
  view: "spotlight" | "phone";
  /** Done once when the step first shows. */
  enter?: ActionId;
  /** Done once when Next leaves the step, without waiting for it. */
  leave?: ActionId;
  /** The card describes the result only once this holds; until then it says what is under way. */
  until: ConditionId;
  /** The result counts as on screen only once this selector matches too. */
  shownWhen?: string;
  /** After this long without the result, the card adds `late` and still lets the visitor go on. */
  timeoutMs: number;
  /** Every card this step can show, by name. Numbers and names come from the facts, never from here. */
  words: Readonly<Record<string, StepCopy>>;
  /** Which card fits what is on screen now. */
  pick: (facts: TourFacts, shown: boolean) => string;
  late: string;
  flow?: (facts: TourFacts, shown: boolean) => FlowStage;
}

const BLOCKED: Partial<Record<NonNullable<BasketLine["reasonCode"]>, string>> = {
  no_stock_in_time: "late",
  cutoff_passed: "cutoff",
  not_found: "missing",
};

/** The red line's card, by why it is red: nuts get their own words, the rest say what the line says. */
function redWords(line: BasketLine): string {
  if (line.reasonCode === "allergen") return /\bnut/i.test(line.reason) ? "nuts" : "allergen";
  return (line.reasonCode && BLOCKED[line.reasonCode]) ?? "rules";
}

const SLOW = "The page is slow. Press Next to go on.";

/** The challenge's own example: its result, inline under the "Order directly" box. */
const EXAMPLE_RESULT = '[data-tour="milk-result"]';

export const STEPS: readonly TourStep[] = [
  {
    id: "today",
    routes: ["/buyer"],
    target: ['[data-choice="order"]', '[data-tour="today-choices"]', ".today-choices"],
    also: ['[data-choice="plan"]'],
    view: "spotlight",
    until: "now",
    timeoutMs: 3_000,
    words: {
      shown: {
        title: "This is the customer’s Today.",
        detail: "Two big choices: order directly, or plan an event. Below them waits this week’s order.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "example",
    routes: ["/buyer"],
    target: [EXAMPLE_RESULT, '[data-choice="order"]'],
    also: ['[data-tour="milk-example"]'],
    view: "spotlight",
    enter: "pressExample",
    until: "exampleDone",
    timeoutMs: 15_000,
    words: {
      working: {
        title: "The challenge’s own example.",
        detail: "Lactose-free milk by Monday. The agent looks it up and asks Valio Aimo for a signed fixed price.",
      },
      alone: {
        title: "Request, lookup, order. No person needed.",
        detail: "Valio Aimo signed a fixed price. The order is inside the customer’s limits, so the agent placed it alone.",
      },
      waits: {
        title: "Request, lookup, order. Now a person approves.",
        detail: "Valio Aimo signed a fixed price. The order is outside what the agent may do alone, so it waits.",
      },
      refused: {
        title: "Request and lookup. Then the rules said no.",
        detail: "The agent found the product, but the order is outside the customer’s limits. Nothing was ordered.",
      },
    },
    pick: (facts) => facts.example ?? "working",
    late: "The example is slow today. Press Next to go on.",
    flow: (facts) => (facts.example ? "approval" : "lookup"),
  },
  {
    id: "basket",
    routes: ["/buyer"],
    // The verdict and its counts, not the whole card: the counts are where the lines turn green.
    target: ['[data-tour="basket"] .weekly-tiles', '[data-tour="basket"]'],
    also: ['[data-tour="basket"] .weekly-verdict-top'],
    view: "spotlight",
    enter: "startWeekly",
    until: "basketDone",
    timeoutMs: 40_000,
    words: {
      starting: { title: "Now the weekly order.", detail: "One tap starts it. The agent works through every line alone." },
      working: {
        title: "The agent works through {lines} lines.",
        detail: "It finds each product, gets a signed price and checks the customer’s rules. Lines turn green as they are ordered.",
      },
      shown: {
        title: "{alone} of {lines} lines ordered alone.",
        detail: "Green means ordered, inside the customer’s limits. Nobody had to look at them.",
      },
    },
    pick: (facts) => (facts.done ? "shown" : facts.basket ? "working" : "starting"),
    late: "This takes a little longer. Press Next to go on.",
    flow: (facts) => (facts.done ? "order" : "lookup"),
  },
  {
    id: "needs",
    routes: ["/buyer"],
    target: ['[data-tour="basket-line"][data-state="orange"]', '[data-tour="basket"]'],
    also: ['[data-tour="basket-line"][data-state="orange"] ~ [data-tour="basket-line"][data-state="orange"]'],
    view: "spotlight",
    // The count is read once the agent has finished every line, so it never says 1 and then 2.
    until: "basketDone",
    timeoutMs: 20_000,
    words: {
      waiting: { title: "Some lines need a person.", detail: "The agent is still working. Orange means a person decides." },
      shown: { title: "Why {needed} {needed?line needs:lines need} a person", detail: "{needWhy}" },
      none: { title: "No line needs a person this time.", detail: "Everything fit the customer’s limits. Press Next." },
    },
    pick: (facts) => (!facts.done ? "waiting" : facts.needed ? "shown" : "none"),
    late: "No line needs a person yet. Press Next.",
    flow: () => "approval",
  },
  {
    id: "phone",
    routes: ["/buyer"],
    target: ['[data-tour="basket-line"][data-state="orange"]', '[data-tour="basket"]'],
    view: "phone",
    leave: "resolveOnPhone",
    until: "needsPerson",
    timeoutMs: 8_000,
    words: {
      waiting: { title: "Approve on the phone.", detail: "The lines are still on their way." },
      shown: {
        title: "Approve on the phone.",
        detail: "The purchasing manager sees each waiting line with its reason. One tap decides. Try it, or press Next.",
      },
      answered: { title: "Done. A person decided.", detail: "One tap on the phone was enough. The choice is signed and in the record." },
    },
    pick: (facts, shown) => (!shown ? "waiting" : facts.answeredLine ? "answered" : "shown"),
    late: "No line needs a person yet. Press Next.",
    flow: () => "approval",
  },
  {
    id: "blocked",
    routes: ["/buyer"],
    target: ['[data-tour="basket-line"][data-state="red"]', '[data-tour="basket"]'],
    view: "spotlight",
    until: "blocked",
    timeoutMs: 15_000,
    words: {
      waiting: { title: "The agent checks every line.", detail: "Red means the customer’s rules said no." },
      nuts: { title: "Why {red} {red?line is:lines are} blocked", detail: "{redName} contains nuts. The customer’s own rule says never.{swapLine}" },
      allergen: { title: "Why {red} {red?line is:lines are} blocked", detail: "{redWhy}{swapLine}" },
      late: { title: "Why {red} {red?line is:lines are} blocked", detail: "{redName} cannot arrive in time.{swapLine}" },
      cutoff: { title: "Why {red} {red?line is:lines are} blocked", detail: "The order time for that day has passed." },
      missing: { title: "Why {red} {red?line is:lines are} blocked", detail: "Valio Aimo does not sell {redName}." },
      rules: { title: "Why {red} {red?line is:lines are} blocked", detail: "{redWhy}{swapLine}" },
      none: { title: "No line is blocked this time.", detail: "Red would mean the customer’s rules said no." },
    },
    pick: (facts) => (facts.redLine ? redWords(facts.redLine) : facts.done ? "none" : "waiting"),
    late: "Press Next to go on.",
  },
  {
    id: "limits",
    routes: ["/buyer/mandate"],
    target: ['[data-tour="limits"]', ".mandate-verdict"],
    also: ['section[aria-labelledby="allergies-title"]', ".mandate-page > .count-tiles"],
    view: "spotlight",
    until: "now",
    timeoutMs: 4_000,
    words: {
      shown: {
        title: "The customer sets the limits.",
        detail: "Money per order and per week, allergies, what never to buy. Inside them the agent orders alone. Outside them, a person decides.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "shop",
    routes: ["/buyer/shop"],
    target: [".store-cards > :nth-child(1)", '[data-tour="shop-search"]'],
    more: [".store-cards > :nth-child(2)", ".store-cards > :nth-child(3)"],
    view: "spotlight",
    until: "now",
    shownWhen: ".store-cards > :nth-child(1)",
    timeoutMs: 8_000,
    words: {
      shown: {
        title: "The shop: every product, with pictures.",
        detail: "The customer can also order by hand. Every order from here gets the same checks.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "plan",
    routes: ["/buyer/plan/recipes", "/buyer/plan"],
    target: [".recipe-grid > li:nth-child(1)", '[data-tour="recipes"]', '[data-tour="plan-event"]'],
    more: [".recipe-grid > li:nth-child(2)", ".recipe-grid > li:nth-child(3)"],
    view: "spotlight",
    until: "now",
    timeoutMs: 5_000,
    words: {
      shown: {
        title: "Plan an event with Valio recipes.",
        detail: "Tell the assistant about the event. It suggests menus from Valio’s recipes and a list to order. Today offers ideas on its own.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "valio",
    routes: ["/valio"],
    target: ['[data-tour="valio-overview"]', ".week-card", '[data-tour="valio-flow"]'],
    also: ['[data-tour="valio-agents"]'],
    view: "spotlight",
    until: "now",
    timeoutMs: 4_000,
    words: {
      shown: {
        title: "This is what Valio Aimo sees.",
        detail: "Its customers’ agents and their orders, as they happen. Valio Aimo can pause any agent.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "demand",
    routes: ["/valio/demand"],
    target: ['[data-tour="valio-demand"]', ".week-card", '[data-tour="valio-unserved"]'],
    view: "spotlight",
    until: "now",
    timeoutMs: 4_000,
    words: {
      shown: {
        title: "What customers wanted, and what was lost.",
        detail: "Every request is counted: ordered, or lost and why. Lost demand is recorded too, not only sales.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "security",
    routes: ["/security"],
    target: ['[data-tour="security-checks"]', ".sec-verdict", '[data-tour="security-attempts"]'],
    view: "spotlight",
    until: "now",
    timeoutMs: 4_000,
    words: {
      shown: {
        title: "Every order is checked.",
        detail: "Against the customer’s limits and Valio Aimo’s signed prices. Anything unusual is stopped and flagged, and a person decides.",
      },
    },
    pick: () => "shown",
    late: SLOW,
  },
  {
    id: "record",
    routes: ["/security"],
    target: ['[data-tour="record-seal"]'],
    view: "spotlight",
    until: "now",
    shownWhen: '[data-tour="record-seal"]:not([data-state="checking"])',
    timeoutMs: 6_000,
    words: {
      shown: {
        title: "Every step is sealed in the record.",
        detail: "Each step is signed and chained to the one before. Anyone can check it on their own device.",
      },
    },
    pick: () => "shown",
    late: "The check is slow. Press Next to finish.",
  },
];

/**
 * The spotlight's selector groups: the step's own targets, then the page's main region as the last resort, and the
 * targets lit at the same time. A hook another page has not built yet never strands the tour.
 */
export function spotGroups(step: Pick<TourStep, "target" | "also" | "more">): string[][] {
  return [[...step.target, MAIN_TARGET], [...(step.also ?? [])], ...(step.more ?? []).map((selector) => [selector])].filter((group) => group.length > 0);
}

/** The page a step runs on in this build: the one chosen at Start, else its first page. */
export function routeOf(step: Pick<TourStep, "id" | "routes">, routes: Partial<Record<string, string>>): string {
  return routes[step.id] ?? step.routes[0];
}

/** The numbers and words a card may quote, all read from the product. */
export function countsOf(facts: TourFacts): Counts {
  const red = facts.redLine;
  return {
    lines: facts.lines,
    alone: facts.alone,
    needed: facts.needed,
    red: facts.red,
    steps: STEPS.length,
    needWhy: facts.neededLines.length > 0 ? facts.neededLines.map(lineWhy).join(" ") : undefined,
    redName: red ? capitalWords(red.words) : undefined,
    redWhy: red ? lineWhy(red) : undefined,
    swapLine: red ? (facts.swap ? ` A safe swap is offered: ${facts.swap}.` : "") : undefined,
  };
}

function capitalWords(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The card for the step as the product stands now; a template whose number is not known yet falls back to the first card. */
export function copyOf(step: TourStep, facts: TourFacts, shown: boolean): StepCopy {
  const counts = countsOf(facts);
  const first = Object.values(step.words)[0];
  return fillCopy(step.words[step.pick(facts, shown)] ?? first, counts) ?? fillCopy(first, counts) ?? first;
}

export const INTRO: StepCopy = { title: "Demo walkthrough", detail: "{steps} short steps through every part of Laituri. You only press Next." };

/** The end card: one line, then three big ways on. */
export const END = {
  title: "That was Laituri.",
  choices: [
    { href: "/buyer", label: "Try it yourself" },
    { href: "/buyer/plan", label: "Plan an event" },
    { href: "/connect", label: "Connect your own agent" },
  ],
} as const;
