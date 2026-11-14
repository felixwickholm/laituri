export type StateTone = "success" | "waiting" | "danger" | "neutral";

/** A state as a pale pill of its own hue. The text fades when it changes. */
export function StateWord({ word, tone }: { word: string; tone: StateTone }) {
  return (
    <span className="state" data-tone={tone}>
      <span key={word} className="state-text">
        {word}
      </span>
    </span>
  );
}
