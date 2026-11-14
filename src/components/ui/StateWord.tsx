export type StateTone = "success" | "waiting" | "danger" | "neutral";

/** A state word that cross-fades (with a 2px blur) whenever its text changes. */
export function StateWord({ word, tone }: { word: string; tone: StateTone }) {
  return (
    <span className="state-swap" data-tone={tone}>
      <span key={word} className="state-text">
        {word}
      </span>
    </span>
  );
}
