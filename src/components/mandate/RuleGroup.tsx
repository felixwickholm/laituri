import type { ReactNode } from "react";

interface RuleGroupProps {
  title: string;
  /** alone: the agent buys inside it. ask: it waits for a person. hard: blocked, nobody can approve. */
  strength: "alone" | "ask" | "hard";
  note: string;
  children: ReactNode;
}

const STRENGTH_WORD: Record<RuleGroupProps["strength"], string> = {
  alone: "Buys alone",
  ask: "Asks you first",
  hard: "No override",
};

export function RuleGroup({ title, strength, note, children }: RuleGroupProps) {
  const id = `rules-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className="rule-group" aria-labelledby={id} data-strength={strength}>
      <header className="rule-group-head">
        <h2 id={id}>{title}</h2>
        <span className="strength" data-strength={strength}>
          {STRENGTH_WORD[strength]}
        </span>
      </header>
      <p className="rule-group-note">{note}</p>
      <ul className="rules">{children}</ul>
    </section>
  );
}

/** One rule as a sentence; `detail` holds what sits under it, such as chips or a usage meter. */
export function RuleSentence({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <li className="rule">
      <p className="rule-text">{children}</p>
      {detail ? <div className="rule-detail">{detail}</div> : null}
    </li>
  );
}
