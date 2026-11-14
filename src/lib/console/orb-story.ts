import { RuleId } from "@/lib/contracts";
import type { OrbState } from "./orb-params";

/** One beat of the landing page's orb story. Rules fill from `rules[0]` to `rules[1]` across the beat. */
export interface StoryBeat {
  at: number;
  state: OrbState;
  caption: string;
  digits: string;
  rules: [number, number];
  /** The live offer, shown as a chip beside the orb while it is valid. */
  offer?: string;
}

export interface StoryFrame {
  state: OrbState;
  caption: string;
  digits: string;
  rulesPassed: number;
  rulesTotal: number;
  offer?: string;
}

/** Every rule of the mandate, as many as the contract names. */
const RULES = RuleId.options.length;
const MILK = "4643061000";
const OVER = "4643061600";

/**
 * Two purchases told in about 18 seconds, as the demo runs them: 1,000 l goes through on its own,
 * 1,600 l stops at the per-order limit and waits for Maria. Amounts are the mock API's €1.01 per litre.
 */
export const STORY: StoryBeat[] = [
  { at: 0, state: "thinking", caption: "Asked: 1,000 l lactose-free milk by Monday.", digits: MILK, rules: [0, 0] },
  { at: 1600, state: "acting", caption: "Searched the catalogue · best match Valio Eila lactose-free 1 l.", digits: "464306", rules: [0, 0] },
  { at: 3200, state: "acting", caption: "Offer signed by Valio Aimo · €1,010.00 net.", digits: "101000464306", rules: [0, 0], offer: "€1,010.00" },
  { at: 4600, state: "thinking", caption: "Checking the signed mandate, rule by rule.", digits: "101000", rules: [0, RULES], offer: "€1,010.00" },
  { at: 7600, state: "signed", caption: `Confirmed. ${RULES} of ${RULES} rules passed. Arrives Monday.`, digits: "101000", rules: [RULES, RULES] },
  { at: 9800, state: "thinking", caption: "Asked: 1,600 l lactose-free milk by Monday.", digits: OVER, rules: [0, 0] },
  { at: 11200, state: "acting", caption: "Offer signed by Valio Aimo · €1,616.00 net.", digits: "161600464306", rules: [0, 0], offer: "€1,616.00" },
  { at: 12400, state: "thinking", caption: "Checking the signed mandate, rule by rule.", digits: "161600", rules: [0, RULES - 1], offer: "€1,616.00" },
  { at: 14200, state: "approval", caption: "Needs Maria: €116.00 over the €1,500.00 per-order limit.", digits: "161600", rules: [RULES - 1, RULES - 1], offer: "€1,616.00" },
];

export const STORY_LENGTH_MS = 19000;

/** The story at `ms` from its start; it loops. */
export function storyFrame(ms: number, beats: StoryBeat[] = STORY, length = STORY_LENGTH_MS): StoryFrame {
  const t = ((ms % length) + length) % length;
  let index = 0;
  for (let i = 0; i < beats.length; i++) if (beats[i].at <= t) index = i;
  const beat = beats[index];
  const end = beats[index + 1]?.at ?? length;
  const progress = end > beat.at ? Math.min(1, (t - beat.at) / (end - beat.at)) : 1;
  const [from, to] = beat.rules;
  return {
    state: beat.state,
    caption: beat.caption,
    digits: beat.digits,
    rulesPassed: Math.round(from + (to - from) * progress),
    rulesTotal: RULES,
    offer: beat.offer,
  };
}

/** The beat to show for a forced state, so a still frame can show any state with fitting words. */
export function storyFrameFor(state: OrbState): StoryFrame {
  if (state === "listening") return { state, caption: "Listening…", digits: MILK, rulesPassed: 0, rulesTotal: RULES };
  if (state === "blocked") {
    return { state, caption: "Blocked. Contains nuts. The mandate forbids nuts.", digits: "120000", rulesPassed: 7, rulesTotal: RULES };
  }
  if (state === "idle") return { state, caption: `Idle. ${RULES} rules ready.`, digits: MILK, rulesPassed: RULES, rulesTotal: RULES };
  const index = STORY.findIndex((beat) => beat.state === state);
  const beat = STORY[Math.max(0, index)];
  return storyFrame(beat.at + 1200);
}
