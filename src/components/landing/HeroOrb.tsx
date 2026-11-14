"use client";

import { useEffect, useState } from "react";
import type { OrbState } from "@/lib/console/orb-params";
import { storyFrame, storyFrameFor } from "@/lib/console/orb-story";
import { AgentOrb } from "../orb/AgentOrb";
import { TypedCaption } from "../orb/TypedCaption";

const TICK_MS = 120;

/** Runs the two-purchase story on a loop; pauses with the tab. A pinned state holds one frame still. */
function useStory(pinned: OrbState | undefined) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (pinned) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === "visible") setElapsed((value) => value + Math.min(now - last, 500));
      last = now;
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [pinned]);
  return pinned ? storyFrameFor(pinned) : storyFrame(elapsed);
}

/**
 * The hero's agent orb telling the story by itself: a purchase that goes through, then one that waits for Maria.
 * `pinned` (from `/?orb=<state>`) holds the orb in one state, for review and screenshots.
 */
export function HeroOrb({ pinned }: { pinned?: OrbState }) {
  const frame = useStory(pinned);
  return (
    <figure className="hero-orb">
      <p className="hero-orb-hint mono" aria-hidden="true">
        Drag to spin
      </p>
      <div className="hero-orb-stage">
        <AgentOrb state={frame.state} digits={frame.digits} rulesPassed={frame.rulesPassed} rulesTotal={frame.rulesTotal} size={520} />
        <ul className="orb-chips" aria-label="The mandate at a glance">
          <li className="orb-chip" data-place="top">
            Mandate <span className="orb-chip-key">signed by Maria Lind</span>
          </li>
          <li className="orb-chip" data-place="side">
            <span className="orb-chip-key">Per order up to</span> €1,500.00
          </li>
          <li className="orb-chip" data-place="bottom" data-tone={frame.state === "approval" ? "warn" : undefined} data-hidden={!frame.offer}>
            <span className="orb-chip-key">Signed offer</span> {frame.offer ?? "€0.00"}
          </li>
        </ul>
      </div>
      <figcaption className="hero-orb-caption">
        <TypedCaption text={frame.caption} className="mono" />
        <p className="mono hero-orb-note">Every step is signed. Change one line and the log breaks.</p>
      </figcaption>
    </figure>
  );
}
