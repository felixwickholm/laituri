import type { OrbState } from "@/lib/console/orb-params";

const CENTRE = 100;
const RING_R = 94;
const ARC_R = 79;
const DISC_R = 63;
const GAP_DEG = 4.5;

type ArcStatus = "pass" | "ask" | "fail" | "todo";

function polar(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [CENTRE + radius * Math.cos(radians), CENTRE + radius * Math.sin(radians)];
}

/** An SVG arc path on the rule ring from `start` to `end` degrees, clockwise from the top. */
export function arcPath(start: number, end: number, radius = ARC_R): string {
  const [x1, y1] = polar(radius, start);
  const [x2, y2] = polar(radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Which arc shows what: passed rules filled, the rule that stopped the order in its state colour. */
export function arcStatus(index: number, passed: number, state: OrbState): ArcStatus {
  if (index < passed) return "pass";
  if (index === passed && state === "approval") return "ask";
  if (index === passed && state === "blocked") return "fail";
  return "todo";
}

interface SealProps {
  state: OrbState;
  rulesPassed: number;
  rulesTotal: number;
}

/**
 * The Laituri seal: the outer ring is the signed mandate, each inner arc one of its rules, filling as the
 * rule passes. Laituri's mark sits in the middle: the agent docked at the quay.
 */
export function Seal({ state, rulesPassed, rulesTotal }: SealProps) {
  const total = Math.max(1, rulesTotal);
  const span = 360 / total;
  const arcs = Array.from({ length: total }, (_, index) => {
    const start = index * span + GAP_DEG / 2;
    return { index, d: arcPath(start, start + span - GAP_DEG), status: arcStatus(index, rulesPassed, state) };
  });
  return (
    <svg className="orb-seal-svg" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="seal-ring" cx={CENTRE} cy={CENTRE} r={RING_R} />
      <circle className="seal-sweep" cx={CENTRE} cy={CENTRE} r={RING_R} pathLength={1} transform={`rotate(-90 ${CENTRE} ${CENTRE})`} />
      <circle className="seal-pulse" cx={CENTRE} cy={CENTRE} r={RING_R} />
      {arcs.map((arc) => (
        <g key={arc.index} className="seal-arc" data-status={arc.status}>
          <path className="seal-arc-track" d={arc.d} />
          <path className="seal-arc-fill" d={arc.d} pathLength={1} />
        </g>
      ))}
      <circle className="seal-disc" cx={CENTRE} cy={CENTRE} r={DISC_R} />
      <g className="seal-mark" transform="translate(82 82) scale(0.9)">
        <path d="M0 4A4 4 0 0 1 4 0L8 0A4 4 0 0 1 12 4L12 28L36 28A4 4 0 0 1 40 32L40 36A4 4 0 0 1 36 40L4 40A4 4 0 0 1 0 36Z" />
        <path className="seal-mark-agent" d="M20 4A4 4 0 0 1 24 0L36 0A4 4 0 0 1 40 4L40 16A4 4 0 0 1 36 20L24 20A4 4 0 0 1 20 16Z" />
      </g>
    </svg>
  );
}
